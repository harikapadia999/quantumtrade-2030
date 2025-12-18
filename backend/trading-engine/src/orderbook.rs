use crate::order::{Order, OrderSide, OrderStatus, Trade};
use dashmap::DashMap;
use rust_decimal::Decimal;
use std::collections::BTreeMap;
use std::sync::Arc;
use uuid::Uuid;

type PriceLevel = BTreeMap<Uuid, Order>;

#[derive(Debug)]
pub struct OrderBook {
    symbol: String,
    bids: Arc<DashMap<Decimal, PriceLevel>>, // Buy orders (descending price)
    asks: Arc<DashMap<Decimal, PriceLevel>>, // Sell orders (ascending price)
}

impl OrderBook {
    pub fn new(symbol: String) -> Self {
        Self {
            symbol,
            bids: Arc::new(DashMap::new()),
            asks: Arc::new(DashMap::new()),
        }
    }

    pub fn add_order(&self, mut order: Order) -> Result<Vec<Trade>, String> {
        if order.symbol != self.symbol {
            return Err(format!("Order symbol {} does not match orderbook symbol {}", order.symbol, self.symbol));
        }

        order.status = OrderStatus::Open;
        let mut trades = Vec::new();

        // Try to match the order
        trades.extend(self.match_order(&mut order)?);

        // If order still has remaining quantity, add to book
        if order.remaining_quantity() > Decimal::ZERO && order.status != OrderStatus::Filled {
            self.insert_order(order)?;
        }

        Ok(trades)
    }

    fn match_order(&self, order: &mut Order) -> Result<Vec<Trade>, String> {
        let mut trades = Vec::new();

        let opposite_side = match order.side {
            OrderSide::Buy => &self.asks,
            OrderSide::Sell => &self.bids,
        };

        // Get sorted price levels
        let mut price_levels: Vec<_> = opposite_side
            .iter()
            .map(|entry| (*entry.key(), entry.value().clone()))
            .collect();

        // Sort based on order side (best prices first)
        match order.side {
            OrderSide::Buy => price_levels.sort_by(|a, b| a.0.cmp(&b.0)), // Ascending for asks
            OrderSide::Sell => price_levels.sort_by(|a, b| b.0.cmp(&a.0)), // Descending for bids
        }

        for (price, mut level_orders) in price_levels {
            if order.remaining_quantity() <= Decimal::ZERO {
                break;
            }

            // Check if price matches
            if !self.price_matches(order, price) {
                break;
            }

            // Match against orders at this price level
            let order_ids: Vec<Uuid> = level_orders.keys().copied().collect();
            
            for order_id in order_ids {
                if order.remaining_quantity() <= Decimal::ZERO {
                    break;
                }

                if let Some(mut matching_order) = level_orders.remove(&order_id) {
                    let trade_quantity = order.remaining_quantity().min(matching_order.remaining_quantity());
                    let trade_price = matching_order.price.unwrap_or(price);

                    // Create trade
                    let trade = match order.side {
                        OrderSide::Buy => Trade::new(
                            self.symbol.clone(),
                            order,
                            &matching_order,
                            trade_quantity,
                            trade_price,
                        ),
                        OrderSide::Sell => Trade::new(
                            self.symbol.clone(),
                            &matching_order,
                            order,
                            trade_quantity,
                            trade_price,
                        ),
                    };

                    // Update orders
                    order.update_fill(trade_quantity, trade_price);
                    matching_order.update_fill(trade_quantity, trade_price);

                    trades.push(trade);

                    // If matching order still has quantity, put it back
                    if matching_order.remaining_quantity() > Decimal::ZERO {
                        level_orders.insert(order_id, matching_order);
                    }
                }
            }

            // Update the price level
            if level_orders.is_empty() {
                opposite_side.remove(&price);
            } else {
                opposite_side.insert(price, level_orders);
            }
        }

        Ok(trades)
    }

    fn price_matches(&self, order: &Order, level_price: Decimal) -> bool {
        match order.side {
            OrderSide::Buy => {
                if let Some(order_price) = order.price {
                    order_price >= level_price
                } else {
                    true // Market order
                }
            }
            OrderSide::Sell => {
                if let Some(order_price) = order.price {
                    order_price <= level_price
                } else {
                    true // Market order
                }
            }
        }
    }

    fn insert_order(&self, order: Order) -> Result<(), String> {
        let price = order.price.ok_or("Limit order must have a price")?;
        
        let book = match order.side {
            OrderSide::Buy => &self.bids,
            OrderSide::Sell => &self.asks,
        };

        book.entry(price)
            .or_insert_with(BTreeMap::new)
            .insert(order.id, order);

        Ok(())
    }

    pub fn cancel_order(&self, order_id: Uuid, side: OrderSide) -> Result<Order, String> {
        let book = match side {
            OrderSide::Buy => &self.bids,
            OrderSide::Sell => &self.asks,
        };

        for mut entry in book.iter_mut() {
            if let Some(mut order) = entry.value_mut().remove(&order_id) {
                order.status = OrderStatus::Cancelled;
                
                // Clean up empty price levels
                if entry.value().is_empty() {
                    let price = *entry.key();
                    drop(entry);
                    book.remove(&price);
                }
                
                return Ok(order);
            }
        }

        Err(format!("Order {} not found", order_id))
    }

    pub fn get_best_bid(&self) -> Option<Decimal> {
        self.bids
            .iter()
            .map(|entry| *entry.key())
            .max()
    }

    pub fn get_best_ask(&self) -> Option<Decimal> {
        self.asks
            .iter()
            .map(|entry| *entry.key())
            .min()
    }

    pub fn get_spread(&self) -> Option<Decimal> {
        match (self.get_best_bid(), self.get_best_ask()) {
            (Some(bid), Some(ask)) => Some(ask - bid),
            _ => None,
        }
    }

    pub fn get_mid_price(&self) -> Option<Decimal> {
        match (self.get_best_bid(), self.get_best_ask()) {
            (Some(bid), Some(ask)) => Some((bid + ask) / Decimal::from(2)),
            _ => None,
        }
    }

    pub fn get_depth(&self, levels: usize) -> (Vec<(Decimal, Decimal)>, Vec<(Decimal, Decimal)>) {
        let bids: Vec<_> = self.bids
            .iter()
            .map(|entry| {
                let price = *entry.key();
                let quantity: Decimal = entry.value().values().map(|o| o.remaining_quantity()).sum();
                (price, quantity)
            })
            .collect();

        let asks: Vec<_> = self.asks
            .iter()
            .map(|entry| {
                let price = *entry.key();
                let quantity: Decimal = entry.value().values().map(|o| o.remaining_quantity()).sum();
                (price, quantity)
            })
            .collect();

        let mut sorted_bids = bids;
        sorted_bids.sort_by(|a, b| b.0.cmp(&a.0));
        sorted_bids.truncate(levels);

        let mut sorted_asks = asks;
        sorted_asks.sort_by(|a, b| a.0.cmp(&b.0));
        sorted_asks.truncate(levels);

        (sorted_bids, sorted_asks)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::order::{OrderType, TimeInForce};

    #[test]
    fn test_orderbook_matching() {
        let orderbook = OrderBook::new("BTC-USD".to_string());

        // Add sell order
        let sell_order = Order::new(
            Uuid::new_v4(),
            "BTC-USD".to_string(),
            OrderSide::Sell,
            OrderType::Limit,
            Decimal::from(1),
            Some(Decimal::from(50000)),
            TimeInForce::GTC,
        );

        let trades = orderbook.add_order(sell_order).unwrap();
        assert_eq!(trades.len(), 0);

        // Add matching buy order
        let buy_order = Order::new(
            Uuid::new_v4(),
            "BTC-USD".to_string(),
            OrderSide::Buy,
            OrderType::Limit,
            Decimal::from(1),
            Some(Decimal::from(50000)),
            TimeInForce::GTC,
        );

        let trades = orderbook.add_order(buy_order).unwrap();
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].quantity, Decimal::from(1));
        assert_eq!(trades[0].price, Decimal::from(50000));
    }

    #[test]
    fn test_best_bid_ask() {
        let orderbook = OrderBook::new("BTC-USD".to_string());

        let sell1 = Order::new(
            Uuid::new_v4(),
            "BTC-USD".to_string(),
            OrderSide::Sell,
            OrderType::Limit,
            Decimal::from(1),
            Some(Decimal::from(50100)),
            TimeInForce::GTC,
        );
        orderbook.add_order(sell1).unwrap();

        let buy1 = Order::new(
            Uuid::new_v4(),
            "BTC-USD".to_string(),
            OrderSide::Buy,
            OrderType::Limit,
            Decimal::from(1),
            Some(Decimal::from(49900)),
            TimeInForce::GTC,
        );
        orderbook.add_order(buy1).unwrap();

        assert_eq!(orderbook.get_best_bid(), Some(Decimal::from(49900)));
        assert_eq!(orderbook.get_best_ask(), Some(Decimal::from(50100)));
        assert_eq!(orderbook.get_spread(), Some(Decimal::from(200)));
        assert_eq!(orderbook.get_mid_price(), Some(Decimal::from(50000)));
    }
}
