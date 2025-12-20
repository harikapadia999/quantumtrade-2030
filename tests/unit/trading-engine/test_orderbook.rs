#[cfg(test)]
mod orderbook_tests {
    use super::*;
    use crate::order::{Order, OrderSide, OrderType, TimeInForce};
    use crate::orderbook::OrderBook;
    use rust_decimal::Decimal;
    use uuid::Uuid;

    fn create_test_order(
        side: OrderSide,
        price: Option<Decimal>,
        quantity: Decimal,
    ) -> Order {
        Order::new(
            Uuid::new_v4(),
            "BTC-USD".to_string(),
            side,
            if price.is_some() { OrderType::Limit } else { OrderType::Market },
            quantity,
            price,
            TimeInForce::GTC,
        )
    }

    #[test]
    fn test_orderbook_creation() {
        let orderbook = OrderBook::new("BTC-USD".to_string());
        assert_eq!(orderbook.get_best_bid(), None);
        assert_eq!(orderbook.get_best_ask(), None);
    }

    #[test]
    fn test_add_limit_order() {
        let orderbook = OrderBook::new("BTC-USD".to_string());
        
        let order = create_test_order(
            OrderSide::Buy,
            Some(Decimal::from(50000)),
            Decimal::from(1),
        );

        let trades = orderbook.add_order(order).unwrap();
        assert_eq!(trades.len(), 0);
        assert_eq!(orderbook.get_best_bid(), Some(Decimal::from(50000)));
    }

    #[test]
    fn test_order_matching() {
        let orderbook = OrderBook::new("BTC-USD".to_string());

        // Add sell order
        let sell_order = create_test_order(
            OrderSide::Sell,
            Some(Decimal::from(50000)),
            Decimal::from(1),
        );
        orderbook.add_order(sell_order).unwrap();

        // Add matching buy order
        let buy_order = create_test_order(
            OrderSide::Buy,
            Some(Decimal::from(50000)),
            Decimal::from(1),
        );

        let trades = orderbook.add_order(buy_order).unwrap();
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].price, Decimal::from(50000));
        assert_eq!(trades[0].quantity, Decimal::from(1));
    }

    #[test]
    fn test_partial_fill() {
        let orderbook = OrderBook::new("BTC-USD".to_string());

        // Add large sell order
        let sell_order = create_test_order(
            OrderSide::Sell,
            Some(Decimal::from(50000)),
            Decimal::from(5),
        );
        orderbook.add_order(sell_order).unwrap();

        // Add smaller buy order
        let buy_order = create_test_order(
            OrderSide::Buy,
            Some(Decimal::from(50000)),
            Decimal::from(2),
        );

        let trades = orderbook.add_order(buy_order).unwrap();
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].quantity, Decimal::from(2));

        // Remaining sell order should still be in book
        let (_, asks) = orderbook.get_depth(10);
        assert_eq!(asks.len(), 1);
        assert_eq!(asks[0].1, Decimal::from(3)); // 5 - 2 = 3 remaining
    }

    #[test]
    fn test_price_time_priority() {
        let orderbook = OrderBook::new("BTC-USD".to_string());

        // Add first sell order at 50000
        let sell1 = create_test_order(
            OrderSide::Sell,
            Some(Decimal::from(50000)),
            Decimal::from(1),
        );
        orderbook.add_order(sell1).unwrap();

        // Add second sell order at same price
        let sell2 = create_test_order(
            OrderSide::Sell,
            Some(Decimal::from(50000)),
            Decimal::from(1),
        );
        orderbook.add_order(sell2).unwrap();

        // Buy order should match with first sell order (time priority)
        let buy_order = create_test_order(
            OrderSide::Buy,
            Some(Decimal::from(50000)),
            Decimal::from(1),
        );

        let trades = orderbook.add_order(buy_order).unwrap();
        assert_eq!(trades.len(), 1);
    }

    #[test]
    fn test_market_order() {
        let orderbook = OrderBook::new("BTC-USD".to_string());

        // Add sell orders at different prices
        let sell1 = create_test_order(
            OrderSide::Sell,
            Some(Decimal::from(50000)),
            Decimal::from(1),
        );
        orderbook.add_order(sell1).unwrap();

        let sell2 = create_test_order(
            OrderSide::Sell,
            Some(Decimal::from(50100)),
            Decimal::from(1),
        );
        orderbook.add_order(sell2).unwrap();

        // Market buy order should match with best ask (50000)
        let market_buy = create_test_order(
            OrderSide::Buy,
            None,
            Decimal::from(1),
        );

        let trades = orderbook.add_order(market_buy).unwrap();
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].price, Decimal::from(50000));
    }

    #[test]
    fn test_cancel_order() {
        let orderbook = OrderBook::new("BTC-USD".to_string());

        let order = create_test_order(
            OrderSide::Buy,
            Some(Decimal::from(50000)),
            Decimal::from(1),
        );
        let order_id = order.id;

        orderbook.add_order(order).unwrap();
        assert_eq!(orderbook.get_best_bid(), Some(Decimal::from(50000)));

        // Cancel order
        let cancelled = orderbook.cancel_order(order_id, OrderSide::Buy).unwrap();
        assert_eq!(cancelled.id, order_id);
        assert_eq!(orderbook.get_best_bid(), None);
    }

    #[test]
    fn test_spread_calculation() {
        let orderbook = OrderBook::new("BTC-USD".to_string());

        let buy_order = create_test_order(
            OrderSide::Buy,
            Some(Decimal::from(49900)),
            Decimal::from(1),
        );
        orderbook.add_order(buy_order).unwrap();

        let sell_order = create_test_order(
            OrderSide::Sell,
            Some(Decimal::from(50100)),
            Decimal::from(1),
        );
        orderbook.add_order(sell_order).unwrap();

        assert_eq!(orderbook.get_spread(), Some(Decimal::from(200)));
        assert_eq!(orderbook.get_mid_price(), Some(Decimal::from(50000)));
    }

    #[test]
    fn test_depth() {
        let orderbook = OrderBook::new("BTC-USD".to_string());

        // Add multiple buy orders
        for i in 0..5 {
            let order = create_test_order(
                OrderSide::Buy,
                Some(Decimal::from(50000 - (i * 100))),
                Decimal::from(1),
            );
            orderbook.add_order(order).unwrap();
        }

        // Add multiple sell orders
        for i in 0..5 {
            let order = create_test_order(
                OrderSide::Sell,
                Some(Decimal::from(50100 + (i * 100))),
                Decimal::from(1),
            );
            orderbook.add_order(order).unwrap();
        }

        let (bids, asks) = orderbook.get_depth(3);
        assert_eq!(bids.len(), 3);
        assert_eq!(asks.len(), 3);

        // Verify bids are sorted descending
        assert!(bids[0].0 > bids[1].0);
        assert!(bids[1].0 > bids[2].0);

        // Verify asks are sorted ascending
        assert!(asks[0].0 < asks[1].0);
        assert!(asks[1].0 < asks[2].0);
    }

    #[test]
    fn test_multiple_matches() {
        let orderbook = OrderBook::new("BTC-USD".to_string());

        // Add multiple sell orders
        let sell1 = create_test_order(
            OrderSide::Sell,
            Some(Decimal::from(50000)),
            Decimal::from(1),
        );
        orderbook.add_order(sell1).unwrap();

        let sell2 = create_test_order(
            OrderSide::Sell,
            Some(Decimal::from(50000)),
            Decimal::from(1),
        );
        orderbook.add_order(sell2).unwrap();

        // Large buy order should match both
        let buy_order = create_test_order(
            OrderSide::Buy,
            Some(Decimal::from(50000)),
            Decimal::from(2),
        );

        let trades = orderbook.add_order(buy_order).unwrap();
        assert_eq!(trades.len(), 2);
        assert_eq!(trades[0].quantity + trades[1].quantity, Decimal::from(2));
    }

    #[test]
    fn test_price_improvement() {
        let orderbook = OrderBook::new("BTC-USD".to_string());

        // Add sell order at 50000
        let sell_order = create_test_order(
            OrderSide::Sell,
            Some(Decimal::from(50000)),
            Decimal::from(1),
        );
        orderbook.add_order(sell_order).unwrap();

        // Buy order willing to pay more should still get best price
        let buy_order = create_test_order(
            OrderSide::Buy,
            Some(Decimal::from(51000)),
            Decimal::from(1),
        );

        let trades = orderbook.add_order(buy_order).unwrap();
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].price, Decimal::from(50000)); // Gets better price
    }
}
