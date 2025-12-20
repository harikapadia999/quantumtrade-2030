'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from './useWebSocket';

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  marketCap?: number;
  timestamp: number;
}

export function useMarketData(symbol: string) {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connected, subscribe, on } = useWebSocket();

  useEffect(() => {
    // Fetch initial data
    fetchMarketData();

    // Subscribe to real-time updates
    if (connected) {
      subscribe(`market:${symbol}`);

      const unsubscribe = on('market:update', (data: any) => {
        if (data.symbol === symbol) {
          setMarketData(data.data);
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [symbol, connected]);

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/market-data/ticker/${symbol}`);
      const data = await response.json();

      if (data.success) {
        setMarketData(data.ticker);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch market data');
      }
    } catch (err) {
      console.error('Failed to fetch market data:', err);
      setError('Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchMarketData();
  };

  return {
    marketData,
    loading,
    error,
    refresh,
  };
}
