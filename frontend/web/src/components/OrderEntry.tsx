'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface OrderEntryProps {
  symbol: string;
}

export function OrderEntry({ symbol }: OrderEntryProps) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop_loss'>('limit');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const orderData: any = {
        symbol,
        side,
        type: orderType,
        quantity: parseFloat(quantity),
        leverage,
      };

      if (orderType === 'limit' || orderType === 'stop_loss') {
        orderData.price = parseFloat(price);
      }

      if (orderType === 'stop_loss') {
        orderData.stopPrice = parseFloat(stopPrice);
      }

      const response = await fetch('/api/trading/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`${side.toUpperCase()} order submitted successfully!`);
        
        // Reset form
        setQuantity('');
        setPrice('');
        setStopPrice('');
      } else {
        toast.error(result.error || 'Failed to submit order');
      }
    } catch (error) {
      console.error('Order submission error:', error);
      toast.error('Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotal = () => {
    const qty = parseFloat(quantity) || 0;
    const prc = parseFloat(price) || 0;
    return (qty * prc).toFixed(2);
  };

  const calculateMargin = () => {
    const total = parseFloat(calculateTotal());
    return (total / leverage).toFixed(2);
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h3 className="text-lg font-semibold mb-4">Place Order</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Side selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide('buy')}
            className={`py-2 rounded font-semibold transition ${
              side === 'buy'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide('sell')}
            className={`py-2 rounded font-semibold transition ${
              side === 'sell'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Order type */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Order Type</label>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as any)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop_loss">Stop Loss</option>
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Quantity</label>
          <input
            type="number"
            step="0.00000001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Price (for limit orders) */}
        {(orderType === 'limit' || orderType === 'stop_loss') && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">Price</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        )}

        {/* Stop Price (for stop loss orders) */}
        {orderType === 'stop_loss' && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">Stop Price</label>
            <input
              type="number"
              step="0.01"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        )}

        {/* Leverage */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Leverage: {leverage}x
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={leverage}
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1x</span>
            <span>5x</span>
            <span>10x</span>
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-gray-800 rounded p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Total</span>
            <span className="font-semibold">${calculateTotal()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Margin Required</span>
            <span className="font-semibold">${calculateMargin()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Fee (0.1%)</span>
            <span className="font-semibold">${(parseFloat(calculateTotal()) * 0.001).toFixed(2)}</span>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting || !quantity}
          className={`w-full py-3 rounded font-semibold transition ${
            side === 'buy'
              ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-900'
              : 'bg-red-600 hover:bg-red-700 disabled:bg-red-900'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isSubmitting ? 'Submitting...' : `${side.toUpperCase()} ${symbol}`}
        </button>
      </form>

      {/* Quick actions */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="text-xs text-gray-500 mb-2">Quick Amount</div>
        <div className="grid grid-cols-4 gap-2">
          {['25%', '50%', '75%', '100%'].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => {
                // Calculate based on available balance
                // This would need to fetch actual balance
                const availableBalance = 10000; // Placeholder
                const pctValue = parseInt(pct) / 100;
                const currentPrice = parseFloat(price) || 50000;
                const qty = (availableBalance * pctValue) / currentPrice;
                setQuantity(qty.toFixed(8));
              }}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs"
            >
              {pct}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
