'use client';

import { useState, useEffect } from 'react';
import { TradingChart } from '@/components/TradingChart';
import { OrderBook } from '@/components/OrderBook';
import { OrderEntry } from '@/components/OrderEntry';
import { PositionsList } from '@/components/PositionsList';
import { MarketOverview } from '@/components/MarketOverview';
import { AIInsights } from '@/components/AIInsights';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMarketData } from '@/hooks/useMarketData';

export default function TradingDashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC-USD');
  const { connected, subscribe, unsubscribe } = useWebSocket();
  const { marketData, loading } = useMarketData(selectedSymbol);

  useEffect(() => {
    if (connected) {
      subscribe(`market.${selectedSymbol}`);
      subscribe(`orderbook.${selectedSymbol}`);
      subscribe(`trades.${selectedSymbol}`);
    }

    return () => {
      unsubscribe(`market.${selectedSymbol}`);
      unsubscribe(`orderbook.${selectedSymbol}`);
      unsubscribe(`trades.${selectedSymbol}`);
    };
  }, [connected, selectedSymbol]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                QuantumTrade 2030
              </h1>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-400">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition">
                Portfolio
              </button>
              <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition">
                Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-4">
          {/* Market Overview */}
          <div className="col-span-12">
            <MarketOverview />
          </div>

          {/* Trading Chart */}
          <div className="col-span-12 lg:col-span-8">
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <select
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BTC-USD">BTC/USD</option>
                    <option value="ETH-USD">ETH/USD</option>
                    <option value="SOL-USD">SOL/USD</option>
                    <option value="AAPL">AAPL</option>
                    <option value="TSLA">TSLA</option>
                  </select>

                  {marketData && (
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="text-2xl font-bold">
                          ${marketData.price.toLocaleString()}
                        </div>
                        <div className={`text-sm ${marketData.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {marketData.change24h >= 0 ? '+' : ''}
                          {marketData.change24h.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm">1m</button>
                  <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm">5m</button>
                  <button className="px-3 py-1 bg-blue-600 rounded text-sm">15m</button>
                  <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm">1h</button>
                  <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm">4h</button>
                  <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm">1d</button>
                </div>
              </div>

              <TradingChart symbol={selectedSymbol} />
            </div>

            {/* AI Insights */}
            <div className="mt-4">
              <AIInsights symbol={selectedSymbol} />
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* Order Entry */}
            <OrderEntry symbol={selectedSymbol} />

            {/* Order Book */}
            <OrderBook symbol={selectedSymbol} />
          </div>

          {/* Positions */}
          <div className="col-span-12">
            <PositionsList />
          </div>
        </div>
      </main>
    </div>
  );
}
