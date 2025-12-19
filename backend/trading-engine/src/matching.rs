use crate::order::{Order, OrderSide, Trade};
use rust_decimal::Decimal;

pub struct MatchingEngine;

impl MatchingEngine {
    pub fn new() -> Self {
        Self
    }

    pub fn match_orders(&self, buy_order: &mut Order, sell_order: &mut Order) -> Option<Trade> {
        if !buy_order.can_match(sell_order) {
            return None;
        }

        let trade_quantity = buy_order.remaining_quantity().min(sell_order.remaining_quantity());
        let trade_price = self.determine_trade_price(buy_order, sell_order);

        buy_order.update_fill(trade_quantity, trade_price);
        sell_order.update_fill(trade_quantity, trade_price);

        Some(Trade::new(
            buy_order.symbol.clone(),
            buy_order,
            sell_order,
            trade_quantity,
            trade_price,
        ))
    }

    fn determine_trade_price(&self, buy_order: &Order, sell_order: &Order) -> Decimal {
        // Price-time priority: use the price of the order that arrived first
        if buy_order.created_at < sell_order.created_at {
            buy_order.price.unwrap_or_else(|| sell_order.price.unwrap())
        } else {
            sell_order.price.unwrap_or_else(|| buy_order.price.unwrap())
        }
    }
}
