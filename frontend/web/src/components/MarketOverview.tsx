'use client';

import { useEffect, useState } from 'react';

interface Market {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap?: number;
}

export function MarketOverview() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [filter, setFilter] = useState<'all' | 'crypto' | 'stocks'>('all');

  useEffect(() => {
    fetchMarkets();
    
    const interval = setInterval(fetchMarkets, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchMarkets = async () => {
    try {
      const response = await fetch(`/api/market-data/trending?filter=${filter}`);
      const data = await response.json();
      
      if (data.success) {
        setMarkets(data.markets);
      }
    } catch (error) {
      console.error('Failed to fetch markets:', error);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Market Overview</h3>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'all' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('crypto')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'crypto' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            Crypto
          </button>
          <button
            onClick={() => setFilter('stocks')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'stocks' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            Stocks
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {markets.map((market) => (
          <div
            key={market.symbol}
            className="bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800 cursor-pointer transition"
          >
            <div className="text-sm text-gray-400 mb-1">{market.symbol}</div>
            <div className="text-lg font-bold mb-1">
              ${market.price.toLocaleString()}
            </div>
            <div className={`text-sm font-semibold ${
              market.change24h >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Vol: ${(market.volume24h / 1000000).toFixed(1)}M
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
