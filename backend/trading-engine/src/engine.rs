use crate::order::{Order, Trade};
use crate::orderbook::OrderBook;
use anyhow::Result;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, error};
use uuid::Uuid;

pub struct TradingEngine {
    orderbooks: Arc<DashMap<String, OrderBook>>,
    trade_tx: mpsc::UnboundedSender<Trade>,
    order_tx: mpsc::UnboundedSender<Order>,
}

impl TradingEngine {
    pub async fn new() -> Result<Self> {
        let (trade_tx, mut trade_rx) = mpsc::unbounded_channel();
        let (order_tx, mut order_rx) = mpsc::unbounded_channel();

        // Spawn trade processor
        tokio::spawn(async move {
            while let Some(trade) = trade_rx.recv().await {
                info!("Trade executed: {:?}", trade);
                // Publish to Kafka, update database, etc.
            }
        });

        // Spawn order processor
        tokio::spawn(async move {
            while let Some(order) = order_rx.recv().await {
                info!("Order received: {:?}", order);
            }
        });

        Ok(Self {
            orderbooks: Arc::new(DashMap::new()),
            trade_tx,
            order_tx,
        })
    }

    pub async fn start(&self) -> Result<()> {
        info!("Trading engine started");
        Ok(())
    }

    pub fn submit_order(&self, order: Order) -> Result<Vec<Trade>> {
        let symbol = order.symbol.clone();
        
        // Get or create orderbook
        let orderbook = self.orderbooks
            .entry(symbol.clone())
            .or_insert_with(|| OrderBook::new(symbol));

        // Add order to orderbook
        let trades = orderbook.add_order(order)?;

        // Publish trades
        for trade in &trades {
            let _ = self.trade_tx.send(trade.clone());
        }

        Ok(trades)
    }

    pub fn cancel_order(&self, symbol: &str, order_id: Uuid, side: crate::order::OrderSide) -> Result<Order> {
        let orderbook = self.orderbooks
            .get(symbol)
            .ok_or_else(|| anyhow::anyhow!("Orderbook not found for symbol: {}", symbol))?;

        orderbook.cancel_order(order_id, side)
    }

    pub fn get_orderbook(&self, symbol: &str) -> Option<OrderBook> {
        self.orderbooks.get(symbol).map(|entry| entry.value().clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::order::{OrderSide, OrderType, TimeInForce};
    use rust_decimal::Decimal;

    #[tokio::test]
    async fn test_engine_order_submission() {
        let engine = TradingEngine::new().await.unwrap();

        let order = Order::new(
            Uuid::new_v4(),
            "BTC-USD".to_string(),
            OrderSide::Buy,
            OrderType::Limit,
            Decimal::from(1),
            Some(Decimal::from(50000)),
            TimeInForce::GTC,
        );

        let trades = engine.submit_order(order).unwrap();
        assert_eq!(trades.len(), 0); // No matching orders
    }
}
