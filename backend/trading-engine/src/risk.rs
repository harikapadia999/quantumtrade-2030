use crate::position::{Portfolio, Position};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskLimits {
    pub max_position_size: Decimal,
    pub max_leverage: Decimal,
    pub max_daily_loss: Decimal,
    pub max_portfolio_risk: Decimal,
    pub margin_call_threshold: Decimal,
    pub liquidation_threshold: Decimal,
    pub max_concentration: Decimal, // Max % in single asset
}

impl Default for RiskLimits {
    fn default() -> Self {
        Self {
            max_position_size: Decimal::from(1000000),
            max_leverage: Decimal::from(10),
            max_daily_loss: Decimal::from_str_exact("0.05").unwrap(), // 5%
            max_portfolio_risk: Decimal::from_str_exact("0.20").unwrap(), // 20%
            margin_call_threshold: Decimal::from_str_exact("0.30").unwrap(), // 30%
            liquidation_threshold: Decimal::from_str_exact("0.20").unwrap(), // 20%
            max_concentration: Decimal::from_str_exact("0.25").unwrap(), // 25%
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskMetrics {
    pub value_at_risk: Decimal,
    pub expected_shortfall: Decimal,
    pub sharpe_ratio: Decimal,
    pub max_drawdown: Decimal,
    pub volatility: Decimal,
    pub beta: Decimal,
}

pub struct RiskManager {
    limits: RiskLimits,
    daily_pnl_history: Vec<Decimal>,
}

impl RiskManager {
    pub fn new(limits: RiskLimits) -> Self {
        Self {
            limits,
            daily_pnl_history: Vec::new(),
        }
    }

    pub fn check_order_risk(
        &self,
        portfolio: &Portfolio,
        symbol: &str,
        quantity: Decimal,
        price: Decimal,
        leverage: Decimal,
    ) -> Result<(), RiskViolation> {
        // Check leverage limit
        if leverage > self.limits.max_leverage {
            return Err(RiskViolation::ExcessiveLeverage {
                requested: leverage,
                max: self.limits.max_leverage,
            });
        }

        // Check position size limit
        let position_value = quantity.abs() * price;
        if position_value > self.limits.max_position_size {
            return Err(RiskViolation::ExcessivePositionSize {
                requested: position_value,
                max: self.limits.max_position_size,
            });
        }

        // Check margin availability
        let required_margin = position_value / leverage;
        if required_margin > portfolio.available_margin {
            return Err(RiskViolation::InsufficientMargin {
                required: required_margin,
                available: portfolio.available_margin,
            });
        }

        // Check concentration risk
        let new_exposure = self.calculate_symbol_exposure(portfolio, symbol, quantity, price);
        let concentration = new_exposure / portfolio.total_equity;
        if concentration > self.limits.max_concentration {
            return Err(RiskViolation::ExcessiveConcentration {
                symbol: symbol.to_string(),
                concentration,
                max: self.limits.max_concentration,
            });
        }

        // Check daily loss limit
        if let Some(daily_loss) = self.calculate_daily_loss(portfolio) {
            if daily_loss.abs() > self.limits.max_daily_loss * portfolio.total_equity {
                return Err(RiskViolation::DailyLossLimitExceeded {
                    loss: daily_loss,
                    limit: self.limits.max_daily_loss * portfolio.total_equity,
                });
            }
        }

        Ok(())
    }

    pub fn check_margin_health(&self, portfolio: &Portfolio) -> MarginStatus {
        if portfolio.total_equity == Decimal::ZERO {
            return MarginStatus::Healthy;
        }

        let margin_ratio = portfolio.available_margin / portfolio.total_equity;

        if margin_ratio < self.limits.liquidation_threshold {
            MarginStatus::Liquidation
        } else if margin_ratio < self.limits.margin_call_threshold {
            MarginStatus::MarginCall
        } else {
            MarginStatus::Healthy
        }
    }

    pub fn calculate_var(
        &self,
        portfolio: &Portfolio,
        confidence_level: Decimal,
        time_horizon_days: u32,
    ) -> Decimal {
        // Simplified VaR calculation using historical simulation
        // In production, use more sophisticated methods (Monte Carlo, parametric, etc.)
        
        if self.daily_pnl_history.is_empty() {
            return Decimal::ZERO;
        }

        let mut sorted_pnl = self.daily_pnl_history.clone();
        sorted_pnl.sort();

        let index = ((Decimal::ONE - confidence_level) * Decimal::from(sorted_pnl.len())).to_usize().unwrap_or(0);
        let daily_var = sorted_pnl.get(index).copied().unwrap_or(Decimal::ZERO).abs();

        // Scale to time horizon
        daily_var * Decimal::from(time_horizon_days).sqrt()
    }

    pub fn calculate_expected_shortfall(
        &self,
        portfolio: &Portfolio,
        confidence_level: Decimal,
    ) -> Decimal {
        // Expected Shortfall (CVaR) - average loss beyond VaR
        if self.daily_pnl_history.is_empty() {
            return Decimal::ZERO;
        }

        let mut sorted_pnl = self.daily_pnl_history.clone();
        sorted_pnl.sort();

        let cutoff_index = ((Decimal::ONE - confidence_level) * Decimal::from(sorted_pnl.len()))
            .to_usize()
            .unwrap_or(0);

        let tail_losses: Vec<_> = sorted_pnl.iter().take(cutoff_index).collect();
        
        if tail_losses.is_empty() {
            return Decimal::ZERO;
        }

        let sum: Decimal = tail_losses.iter().map(|&&x| x).sum();
        (sum / Decimal::from(tail_losses.len())).abs()
    }

    pub fn calculate_sharpe_ratio(&self, risk_free_rate: Decimal) -> Decimal {
        if self.daily_pnl_history.is_empty() {
            return Decimal::ZERO;
        }

        let mean_return = self.calculate_mean_return();
        let std_dev = self.calculate_volatility();

        if std_dev == Decimal::ZERO {
            return Decimal::ZERO;
        }

        (mean_return - risk_free_rate) / std_dev
    }

    pub fn calculate_max_drawdown(&self) -> Decimal {
        if self.daily_pnl_history.is_empty() {
            return Decimal::ZERO;
        }

        let mut cumulative_pnl = Decimal::ZERO;
        let mut peak = Decimal::ZERO;
        let mut max_drawdown = Decimal::ZERO;

        for &pnl in &self.daily_pnl_history {
            cumulative_pnl += pnl;
            peak = peak.max(cumulative_pnl);
            let drawdown = peak - cumulative_pnl;
            max_drawdown = max_drawdown.max(drawdown);
        }

        max_drawdown
    }

    fn calculate_symbol_exposure(
        &self,
        portfolio: &Portfolio,
        symbol: &str,
        additional_quantity: Decimal,
        price: Decimal,
    ) -> Decimal {
        let existing_exposure = portfolio
            .get_position(symbol)
            .map(|p| p.quantity.abs() * p.current_price)
            .unwrap_or(Decimal::ZERO);

        existing_exposure + (additional_quantity.abs() * price)
    }

    fn calculate_daily_loss(&self, portfolio: &Portfolio) -> Option<Decimal> {
        // This would track daily P&L in production
        Some(portfolio.total_unrealized_pnl + portfolio.total_realized_pnl)
    }

    fn calculate_mean_return(&self) -> Decimal {
        if self.daily_pnl_history.is_empty() {
            return Decimal::ZERO;
        }

        let sum: Decimal = self.daily_pnl_history.iter().sum();
        sum / Decimal::from(self.daily_pnl_history.len())
    }

    fn calculate_volatility(&self) -> Decimal {
        if self.daily_pnl_history.len() < 2 {
            return Decimal::ZERO;
        }

        let mean = self.calculate_mean_return();
        let variance: Decimal = self.daily_pnl_history
            .iter()
            .map(|&x| (x - mean).powi(2))
            .sum::<Decimal>() / Decimal::from(self.daily_pnl_history.len() - 1);

        variance.sqrt().unwrap_or(Decimal::ZERO)
    }

    pub fn add_daily_pnl(&mut self, pnl: Decimal) {
        self.daily_pnl_history.push(pnl);
        
        // Keep only last 252 days (1 trading year)
        if self.daily_pnl_history.len() > 252 {
            self.daily_pnl_history.remove(0);
        }
    }

    pub fn get_risk_metrics(&self, portfolio: &Portfolio) -> RiskMetrics {
        RiskMetrics {
            value_at_risk: self.calculate_var(portfolio, Decimal::from_str_exact("0.95").unwrap(), 1),
            expected_shortfall: self.calculate_expected_shortfall(portfolio, Decimal::from_str_exact("0.95").unwrap()),
            sharpe_ratio: self.calculate_sharpe_ratio(Decimal::from_str_exact("0.02").unwrap()),
            max_drawdown: self.calculate_max_drawdown(),
            volatility: self.calculate_volatility(),
            beta: Decimal::ONE, // Would calculate against market benchmark
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MarginStatus {
    Healthy,
    MarginCall,
    Liquidation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskViolation {
    ExcessiveLeverage { requested: Decimal, max: Decimal },
    ExcessivePositionSize { requested: Decimal, max: Decimal },
    InsufficientMargin { required: Decimal, available: Decimal },
    ExcessiveConcentration { symbol: String, concentration: Decimal, max: Decimal },
    DailyLossLimitExceeded { loss: Decimal, limit: Decimal },
}

impl std::fmt::Display for RiskViolation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RiskViolation::ExcessiveLeverage { requested, max } => {
                write!(f, "Excessive leverage: requested {}, max {}", requested, max)
            }
            RiskViolation::ExcessivePositionSize { requested, max } => {
                write!(f, "Excessive position size: requested {}, max {}", requested, max)
            }
            RiskViolation::InsufficientMargin { required, available } => {
                write!(f, "Insufficient margin: required {}, available {}", required, available)
            }
            RiskViolation::ExcessiveConcentration { symbol, concentration, max } => {
                write!(f, "Excessive concentration in {}: {}%, max {}%", symbol, concentration * 100, max * 100)
            }
            RiskViolation::DailyLossLimitExceeded { loss, limit } => {
                write!(f, "Daily loss limit exceeded: loss {}, limit {}", loss, limit)
            }
        }
    }
}

impl std::error::Error for RiskViolation {}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_risk_limits() {
        let limits = RiskLimits::default();
        let risk_manager = RiskManager::new(limits);
        
        let portfolio = Portfolio::new(Uuid::new_v4(), Decimal::from(100000));
        
        // Should pass - within limits
        let result = risk_manager.check_order_risk(
            &portfolio,
            "BTC-USD",
            Decimal::from(1),
            Decimal::from(50000),
            Decimal::from(5),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_excessive_leverage() {
        let limits = RiskLimits::default();
        let risk_manager = RiskManager::new(limits);
        
        let portfolio = Portfolio::new(Uuid::new_v4(), Decimal::from(100000));
        
        // Should fail - excessive leverage
        let result = risk_manager.check_order_risk(
            &portfolio,
            "BTC-USD",
            Decimal::from(1),
            Decimal::from(50000),
            Decimal::from(20), // Exceeds max leverage of 10
        );
        assert!(result.is_err());
    }
}
