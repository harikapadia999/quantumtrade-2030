'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

interface OrderBookLevel {
  price: number;
  quantity: number;
  total: number;
}

interface OrderBookProps {
  symbol: string;
}

export function OrderBook({ symbol }: OrderBookProps) {
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);
  const [spread, setSpread] = useState(0);
  const [spreadPercent, setSpreadPercent] = useState(0);
  const { subscribe, on } = useWebSocket();

  useEffect(() => {
    // Subscribe to orderbook updates
    subscribe(`orderbook.${symbol}`);

    // Listen for updates
    const unsubscribe = on('orderbook:update', (data: any) => {
      if (data.symbol === symbol) {
        updateOrderBook(data.data);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [symbol]);

  const updateOrderBook = (data: any) => {
    // Process bids
    const processedBids: OrderBookLevel[] = [];
    let bidTotal = 0;
    
    for (const [price, quantity] of data.bids.slice(0, 15)) {
      bidTotal += quantity;
      processedBids.push({
        price: parseFloat(price),
        quantity: parseFloat(quantity),
        total: bidTotal,
      });
    }

    // Process asks
    const processedAsks: OrderBookLevel[] = [];
    let askTotal = 0;
    
    for (const [price, quantity] of data.asks.slice(0, 15)) {
      askTotal += quantity;
      processedAsks.push({
        price: parseFloat(price),
        quantity: parseFloat(quantity),
        total: askTotal,
      });
    }

    setBids(processedBids);
    setAsks(processedAsks);

    // Calculate spread
    if (processedBids.length > 0 && processedAsks.length > 0) {
      const bestBid = processedBids[0].price;
      const bestAsk = processedAsks[0].price;
      const spreadValue = bestAsk - bestBid;
      const spreadPct = (spreadValue / bestBid) * 100;

      setSpread(spreadValue);
      setSpreadPercent(spreadPct);
    }
  };

  const maxBidTotal = bids.length > 0 ? bids[bids.length - 1].total : 0;
  const maxAskTotal = asks.length > 0 ? asks[asks.length - 1].total : 0;
  const maxTotal = Math.max(maxBidTotal, maxAskTotal);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Order Book</h3>
        <div className="text-sm text-gray-400">
          Spread: ${spread.toFixed(2)} ({spreadPercent.toFixed(3)}%)
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 mb-2 px-2">
        <div>Price (USD)</div>
        <div className="text-right">Amount</div>
        <div className="text-right">Total</div>
      </div>

      {/* Asks (Sell orders) - Reversed to show lowest first */}
      <div className="space-y-0.5 mb-2">
        {asks.slice().reverse().map((ask, index) => (
          <div
            key={`ask-${index}`}
            className="relative grid grid-cols-3 gap-2 text-sm px-2 py-1 hover:bg-gray-800/50 cursor-pointer"
          >
            {/* Background bar */}
            <div
              className="absolute inset-0 bg-red-500/10"
              style={{
                width: `${(ask.total / maxTotal) * 100}%`,
                right: 0,
                left: 'auto',
              }}
            />
            
            <div className="relative text-red-500">{ask.price.toFixed(2)}</div>
            <div className="relative text-right">{ask.quantity.toFixed(4)}</div>
            <div className="relative text-right text-gray-400">{ask.total.toFixed(4)}</div>
          </div>
        ))}
      </div>

      {/* Spread indicator */}
      <div className="py-2 text-center border-y border-gray-800 mb-2">
        <div className="text-lg font-bold">
          {bids.length > 0 && asks.length > 0 ? (
            <>
              <span className="text-green-500">{bids[0].price.toFixed(2)}</span>
              <span className="text-gray-500 mx-2">|</span>
              <span className="text-red-500">{asks[0].price.toFixed(2)}</span>
            </>
          ) : (
            <span className="text-gray-500">Loading...</span>
          )}
        </div>
      </div>

      {/* Bids (Buy orders) */}
      <div className="space-y-0.5">
        {bids.map((bid, index) => (
          <div
            key={`bid-${index}`}
            className="relative grid grid-cols-3 gap-2 text-sm px-2 py-1 hover:bg-gray-800/50 cursor-pointer"
          >
            {/* Background bar */}
            <div
              className="absolute inset-0 bg-green-500/10"
              style={{
                width: `${(bid.total / maxTotal) * 100}%`,
                right: 0,
                left: 'auto',
              }}
            />
            
            <div className="relative text-green-500">{bid.price.toFixed(2)}</div>
            <div className="relative text-right">{bid.quantity.toFixed(4)}</div>
            <div className="relative text-right text-gray-400">{bid.total.toFixed(4)}</div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-500">Bid Volume</div>
          <div className="text-green-500 font-semibold">
            {maxBidTotal.toFixed(4)}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Ask Volume</div>
          <div className="text-red-500 font-semibold">
            {maxAskTotal.toFixed(4)}
          </div>
        </div>
      </div>
    </div>
  );
}
