use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderType {
    Market,
    Limit,
    StopLoss,
    StopLimit,
    TrailingStop,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderStatus {
    Pending,
    Open,
    PartiallyFilled,
    Filled,
    Cancelled,
    Rejected,
    Expired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TimeInForce {
    GTC, // Good Till Cancel
    IOC, // Immediate or Cancel
    FOK, // Fill or Kill
    GTD, // Good Till Date
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: Uuid,
    pub user_id: Uuid,
    pub symbol: String,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub quantity: Decimal,
    pub price: Option<Decimal>,
    pub stop_price: Option<Decimal>,
    pub filled_quantity: Decimal,
    pub average_fill_price: Option<Decimal>,
    pub status: OrderStatus,
    pub time_in_force: TimeInForce,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

impl Order {
    pub fn new(
        user_id: Uuid,
        symbol: String,
        side: OrderSide,
        order_type: OrderType,
        quantity: Decimal,
        price: Option<Decimal>,
        time_in_force: TimeInForce,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            user_id,
            symbol,
            side,
            order_type,
            quantity,
            price,
            stop_price: None,
            filled_quantity: Decimal::ZERO,
            average_fill_price: None,
            status: OrderStatus::Pending,
            time_in_force,
            created_at: now,
            updated_at: now,
            expires_at: None,
        }
    }

    pub fn remaining_quantity(&self) -> Decimal {
        self.quantity - self.filled_quantity
    }

    pub fn is_fully_filled(&self) -> bool {
        self.filled_quantity >= self.quantity
    }

    pub fn can_match(&self, other: &Order) -> bool {
        // Orders must be for the same symbol
        if self.symbol != other.symbol {
            return false;
        }

        // Orders must be on opposite sides
        if self.side == other.side {
            return false;
        }

        // Both orders must have remaining quantity
        if self.remaining_quantity() <= Decimal::ZERO || other.remaining_quantity() <= Decimal::ZERO {
            return false;
        }

        // Price matching logic
        match (self.order_type, other.order_type) {
            (OrderType::Market, _) | (_, OrderType::Market) => true,
            (OrderType::Limit, OrderType::Limit) => {
                if let (Some(self_price), Some(other_price)) = (self.price, other.price) {
                    match self.side {
                        OrderSide::Buy => self_price >= other_price,
                        OrderSide::Sell => self_price <= other_price,
                    }
                } else {
                    false
                }
            }
            _ => false,
        }
    }

    pub fn update_fill(&mut self, quantity: Decimal, price: Decimal) {
        let total_filled_value = self.average_fill_price
            .map(|avg_price| avg_price * self.filled_quantity)
            .unwrap_or(Decimal::ZERO);
        
        let new_fill_value = price * quantity;
        self.filled_quantity += quantity;
        
        self.average_fill_price = Some((total_filled_value + new_fill_value) / self.filled_quantity);
        
        if self.is_fully_filled() {
            self.status = OrderStatus::Filled;
        } else {
            self.status = OrderStatus::PartiallyFilled;
        }
        
        self.updated_at = Utc::now();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: Uuid,
    pub symbol: String,
    pub buy_order_id: Uuid,
    pub sell_order_id: Uuid,
    pub buyer_id: Uuid,
    pub seller_id: Uuid,
    pub quantity: Decimal,
    pub price: Decimal,
    pub timestamp: DateTime<Utc>,
}

impl Trade {
    pub fn new(
        symbol: String,
        buy_order: &Order,
        sell_order: &Order,
        quantity: Decimal,
        price: Decimal,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            symbol,
            buy_order_id: buy_order.id,
            sell_order_id: sell_order.id,
            buyer_id: buy_order.user_id,
            seller_id: sell_order.user_id,
            quantity,
            price,
            timestamp: Utc::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_order_creation() {
        let order = Order::new(
            Uuid::new_v4(),
            "BTC-USD".to_string(),
            OrderSide::Buy,
            OrderType::Limit,
            Decimal::from(1),
            Some(Decimal::from(50000)),
            TimeInForce::GTC,
        );

        assert_eq!(order.status, OrderStatus::Pending);
        assert_eq!(order.filled_quantity, Decimal::ZERO);
        assert_eq!(order.remaining_quantity(), Decimal::from(1));
    }

    #[test]
    fn test_order_matching() {
        let buy_order = Order::new(
            Uuid::new_v4(),
            "BTC-USD".to_string(),
            OrderSide::Buy,
            OrderType::Limit,
            Decimal::from(1),
            Some(Decimal::from(50000)),
            TimeInForce::GTC,
        );

        let sell_order = Order::new(
            Uuid::new_v4(),
            "BTC-USD".to_string(),
            OrderSide::Sell,
            OrderType::Limit,
            Decimal::from(1),
            Some(Decimal::from(49000)),
            TimeInForce::GTC,
        );

        assert!(buy_order.can_match(&sell_order));
    }
}
