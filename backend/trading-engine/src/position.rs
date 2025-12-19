use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub id: Uuid,
    pub user_id: Uuid,
    pub symbol: String,
    pub quantity: Decimal,
    pub average_entry_price: Decimal,
    pub current_price: Decimal,
    pub unrealized_pnl: Decimal,
    pub realized_pnl: Decimal,
    pub margin_used: Decimal,
    pub leverage: Decimal,
    pub liquidation_price: Option<Decimal>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Position {
    pub fn new(
        user_id: Uuid,
        symbol: String,
        quantity: Decimal,
        entry_price: Decimal,
        leverage: Decimal,
    ) -> Self {
        let now = Utc::now();
        let margin_used = (quantity * entry_price) / leverage;
        
        Self {
            id: Uuid::new_v4(),
            user_id,
            symbol,
            quantity,
            average_entry_price: entry_price,
            current_price: entry_price,
            unrealized_pnl: Decimal::ZERO,
            realized_pnl: Decimal::ZERO,
            margin_used,
            leverage,
            liquidation_price: Self::calculate_liquidation_price(entry_price, leverage, quantity > Decimal::ZERO),
            created_at: now,
            updated_at: now,
        }
    }

    pub fn update_price(&mut self, new_price: Decimal) {
        self.current_price = new_price;
        self.unrealized_pnl = self.calculate_unrealized_pnl();
        self.updated_at = Utc::now();
    }

    pub fn calculate_unrealized_pnl(&self) -> Decimal {
        (self.current_price - self.average_entry_price) * self.quantity
    }

    pub fn add_to_position(&mut self, quantity: Decimal, price: Decimal) {
        let total_cost = self.average_entry_price * self.quantity + price * quantity;
        self.quantity += quantity;
        self.average_entry_price = total_cost / self.quantity;
        self.margin_used = (self.quantity * self.average_entry_price) / self.leverage;
        self.liquidation_price = Self::calculate_liquidation_price(
            self.average_entry_price,
            self.leverage,
            self.quantity > Decimal::ZERO,
        );
        self.updated_at = Utc::now();
    }

    pub fn reduce_position(&mut self, quantity: Decimal, exit_price: Decimal) -> Decimal {
        let pnl = (exit_price - self.average_entry_price) * quantity;
        self.realized_pnl += pnl;
        self.quantity -= quantity;
        
        if self.quantity == Decimal::ZERO {
            self.margin_used = Decimal::ZERO;
            self.liquidation_price = None;
        } else {
            self.margin_used = (self.quantity * self.average_entry_price) / self.leverage;
        }
        
        self.updated_at = Utc::now();
        pnl
    }

    pub fn close_position(&mut self, exit_price: Decimal) -> Decimal {
        self.reduce_position(self.quantity, exit_price)
    }

    fn calculate_liquidation_price(
        entry_price: Decimal,
        leverage: Decimal,
        is_long: bool,
    ) -> Option<Decimal> {
        // Simplified liquidation price calculation
        // Real implementation would consider maintenance margin, fees, etc.
        let liquidation_threshold = Decimal::from_str_exact("0.8").unwrap(); // 80% of margin
        
        if is_long {
            // Long position: liquidation when price drops
            Some(entry_price * (Decimal::ONE - liquidation_threshold / leverage))
        } else {
            // Short position: liquidation when price rises
            Some(entry_price * (Decimal::ONE + liquidation_threshold / leverage))
        }
    }

    pub fn is_at_risk(&self) -> bool {
        if let Some(liq_price) = self.liquidation_price {
            if self.quantity > Decimal::ZERO {
                // Long position
                self.current_price <= liq_price * Decimal::from_str_exact("1.1").unwrap()
            } else {
                // Short position
                self.current_price >= liq_price * Decimal::from_str_exact("0.9").unwrap()
            }
        } else {
            false
        }
    }

    pub fn get_margin_ratio(&self) -> Decimal {
        if self.margin_used == Decimal::ZERO {
            return Decimal::ZERO;
        }
        
        let position_value = self.quantity.abs() * self.current_price;
        let equity = position_value + self.unrealized_pnl;
        
        equity / self.margin_used
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Portfolio {
    pub user_id: Uuid,
    pub positions: Vec<Position>,
    pub cash_balance: Decimal,
    pub total_equity: Decimal,
    pub total_margin_used: Decimal,
    pub available_margin: Decimal,
    pub total_unrealized_pnl: Decimal,
    pub total_realized_pnl: Decimal,
}

impl Portfolio {
    pub fn new(user_id: Uuid, initial_balance: Decimal) -> Self {
        Self {
            user_id,
            positions: Vec::new(),
            cash_balance: initial_balance,
            total_equity: initial_balance,
            total_margin_used: Decimal::ZERO,
            available_margin: initial_balance,
            total_unrealized_pnl: Decimal::ZERO,
            total_realized_pnl: Decimal::ZERO,
        }
    }

    pub fn add_position(&mut self, position: Position) {
        self.positions.push(position);
        self.recalculate();
    }

    pub fn update_position_price(&mut self, symbol: &str, new_price: Decimal) {
        for position in &mut self.positions {
            if position.symbol == symbol {
                position.update_price(new_price);
            }
        }
        self.recalculate();
    }

    pub fn recalculate(&mut self) {
        self.total_margin_used = self.positions.iter()
            .map(|p| p.margin_used)
            .sum();
        
        self.total_unrealized_pnl = self.positions.iter()
            .map(|p| p.unrealized_pnl)
            .sum();
        
        self.total_realized_pnl = self.positions.iter()
            .map(|p| p.realized_pnl)
            .sum();
        
        self.total_equity = self.cash_balance + self.total_unrealized_pnl;
        self.available_margin = self.total_equity - self.total_margin_used;
    }

    pub fn get_position(&self, symbol: &str) -> Option<&Position> {
        self.positions.iter().find(|p| p.symbol == symbol)
    }

    pub fn get_position_mut(&mut self, symbol: &str) -> Option<&mut Position> {
        self.positions.iter_mut().find(|p| p.symbol == symbol)
    }

    pub fn get_total_exposure(&self) -> Decimal {
        self.positions.iter()
            .map(|p| p.quantity.abs() * p.current_price)
            .sum()
    }

    pub fn get_leverage_ratio(&self) -> Decimal {
        if self.total_equity == Decimal::ZERO {
            return Decimal::ZERO;
        }
        self.get_total_exposure() / self.total_equity
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_position_creation() {
        let position = Position::new(
            Uuid::new_v4(),
            "BTC-USD".to_string(),
            Decimal::from(1),
            Decimal::from(50000),
            Decimal::from(10),
        );

        assert_eq!(position.quantity, Decimal::from(1));
        assert_eq!(position.average_entry_price, Decimal::from(50000));
        assert_eq!(position.margin_used, Decimal::from(5000));
    }

    #[test]
    fn test_position_pnl() {
        let mut position = Position::new(
            Uuid::new_v4(),
            "BTC-USD".to_string(),
            Decimal::from(1),
            Decimal::from(50000),
            Decimal::from(10),
        );

        position.update_price(Decimal::from(55000));
        assert_eq!(position.unrealized_pnl, Decimal::from(5000));
    }

    #[test]
    fn test_portfolio() {
        let mut portfolio = Portfolio::new(Uuid::new_v4(), Decimal::from(100000));
        
        let position = Position::new(
            portfolio.user_id,
            "BTC-USD".to_string(),
            Decimal::from(1),
            Decimal::from(50000),
            Decimal::from(10),
        );

        portfolio.add_position(position);
        
        assert_eq!(portfolio.total_margin_used, Decimal::from(5000));
        assert_eq!(portfolio.available_margin, Decimal::from(95000));
    }
}
