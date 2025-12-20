'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  marginUsed: number;
  leverage: number;
  liquidationPrice: number | null;
}

export function PositionsList() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPositions();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/portfolio/positions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setPositions(data.positions);
      }
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    } finally {
      setLoading(false);
    }
  };

  const closePosition = async (symbol: string) => {
    if (!confirm(`Are you sure you want to close your ${symbol} position?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/trading/positions/${symbol}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`${symbol} position closed`);
        fetchPositions();
      } else {
        toast.error(result.error || 'Failed to close position');
      }
    } catch (error) {
      console.error('Failed to close position:', error);
      toast.error('Failed to close position');
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
        <div className="text-gray-400">Loading positions...</div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
        <div className="text-gray-400">No open positions</div>
      </div>
    );
  }

  const totalUnrealizedPnl = positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Open Positions</h3>
        <div className="text-sm">
          <span className="text-gray-400">Total P&L: </span>
          <span className={`font-semibold ${totalUnrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr className="text-left text-sm text-gray-400">
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3 text-right">Size</th>
              <th className="px-4 py-3 text-right">Entry Price</th>
              <th className="px-4 py-3 text-right">Current Price</th>
              <th className="px-4 py-3 text-right">P&L</th>
              <th className="px-4 py-3 text-right">P&L %</th>
              <th className="px-4 py-3 text-right">Margin</th>
              <th className="px-4 py-3 text-center">Leverage</th>
              <th className="px-4 py-3 text-right">Liq. Price</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr
                key={position.id}
                className="border-t border-gray-800 hover:bg-gray-800/30 transition"
              >
                <td className="px-4 py-3 font-semibold">{position.symbol}</td>
                <td className="px-4 py-3 text-right">
                  <span className={position.quantity > 0 ? 'text-green-500' : 'text-red-500'}>
                    {position.quantity > 0 ? 'LONG' : 'SHORT'} {Math.abs(position.quantity).toFixed(4)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">${position.averageEntryPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">${position.currentPrice.toFixed(2)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${
                  position.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${
                  position.unrealizedPnlPercent >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {position.unrealizedPnlPercent >= 0 ? '+' : ''}{position.unrealizedPnlPercent.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-right">${position.marginUsed.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">
                    {position.leverage}x
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {position.liquidationPrice ? (
                    <span className="text-red-400">${position.liquidationPrice.toFixed(2)}</span>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => closePosition(position.symbol)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition"
                  >
                    Close
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
