'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';

interface TradingChartProps {
  symbol: string;
}

export function TradingChart({ symbol }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [interval, setInterval] = useState('15m');

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 600,
      layout: {
        background: { color: '#111827' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#1F2937',
      },
      timeScale: {
        borderColor: '#1F2937',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#3B82F6',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    // Fetch and update chart data when symbol or interval changes
    fetchChartData(symbol, interval);
  }, [symbol, interval]);

  const fetchChartData = async (symbol: string, interval: string) => {
    try {
      // Fetch candle data from API
      const response = await fetch(
        `/api/market-data/candles?symbol=${symbol}&interval=${interval}&limit=500`
      );
      const data = await response.json();

      if (data.candles && candlestickSeriesRef.current && volumeSeriesRef.current) {
        // Transform data to lightweight-charts format
        const candleData: CandlestickData[] = data.candles.map((candle: any) => ({
          time: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }));

        const volumeData = data.candles.map((candle: any) => ({
          time: candle.timestamp,
          value: candle.volume,
          color: candle.close >= candle.open ? '#10B98180' : '#EF444480',
        }));

        candlestickSeriesRef.current.setData(candleData);
        volumeSeriesRef.current.setData(volumeData);

        // Fit content
        chartRef.current?.timeScale().fitContent();
      }
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
    }
  };

  return (
    <div className="relative">
      <div ref={chartContainerRef} className="w-full" />
      
      {/* Chart controls */}
      <div className="absolute top-4 left-4 flex space-x-2 z-10">
        <button
          onClick={() => setInterval('1m')}
          className={`px-3 py-1 rounded text-sm ${
            interval === '1m' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          1m
        </button>
        <button
          onClick={() => setInterval('5m')}
          className={`px-3 py-1 rounded text-sm ${
            interval === '5m' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          5m
        </button>
        <button
          onClick={() => setInterval('15m')}
          className={`px-3 py-1 rounded text-sm ${
            interval === '15m' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          15m
        </button>
        <button
          onClick={() => setInterval('1h')}
          className={`px-3 py-1 rounded text-sm ${
            interval === '1h' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          1h
        </button>
        <button
          onClick={() => setInterval('4h')}
          className={`px-3 py-1 rounded text-sm ${
            interval === '4h' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          4h
        </button>
        <button
          onClick={() => setInterval('1d')}
          className={`px-3 py-1 rounded text-sm ${
            interval === '1d' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          1d
        </button>
      </div>

      {/* Indicators */}
      <div className="absolute top-4 right-4 flex space-x-2 z-10">
        <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm">
          MA
        </button>
        <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm">
          RSI
        </button>
        <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm">
          MACD
        </button>
        <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm">
          BB
        </button>
      </div>
    </div>
  );
}
