'use client';

import { useEffect, useState } from 'react';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from '@heroicons/react/24/solid';

interface Prediction {
  horizon: string;
  priceChange: number;
  confidence: number;
  direction: 'up' | 'down' | 'neutral';
}

interface Sentiment {
  score: number;
  confidence: number;
  sources: Record<string, number>;
  volume: number;
}

interface AIInsightsProps {
  symbol: string;
}

export function AIInsights({ symbol }: AIInsightsProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAIInsights();
    
    const interval = setInterval(fetchAIInsights, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [symbol]);

  const fetchAIInsights = async () => {
    try {
      // Fetch predictions
      const predResponse = await fetch(`/api/ai/predictions/${symbol}`);
      const predData = await predResponse.json();
      
      if (predData.success) {
        setPredictions(predData.predictions);
      }

      // Fetch sentiment
      const sentResponse = await fetch(`/api/ai/sentiment/${symbol}`);
      const sentData = await sentResponse.json();
      
      if (sentData.success) {
        setSentiment(sentData.sentiment);
      }
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <div className="text-gray-400 text-center">Loading AI insights...</div>
      </div>
    );
  }

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <ArrowUpIcon className="w-4 h-4 text-green-500" />;
      case 'down':
        return <ArrowDownIcon className="w-4 h-4 text-red-500" />;
      default:
        return <MinusIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.3) return 'text-green-500';
    if (score < -0.3) return 'text-red-500';
    return 'text-gray-400';
  };

  const getSentimentLabel = (score: number) => {
    if (score > 0.5) return 'Very Bullish';
    if (score > 0.2) return 'Bullish';
    if (score > -0.2) return 'Neutral';
    if (score > -0.5) return 'Bearish';
    return 'Very Bearish';
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <span className="mr-2">🤖</span>
          AI Insights
        </h3>
        <div className="text-xs text-gray-500">
          Updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Price Predictions */}
        <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Price Predictions</h4>
          <div className="space-y-2">
            {predictions.map((pred) => (
              <div
                key={pred.horizon}
                className="bg-gray-800/50 rounded p-3 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  {getDirectionIcon(pred.direction)}
                  <span className="text-sm font-medium">{pred.horizon}</span>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${
                    pred.priceChange >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {pred.priceChange >= 0 ? '+' : ''}{pred.priceChange.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {(pred.confidence * 100).toFixed(0)}% confidence
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment Analysis */}
        <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Market Sentiment</h4>
          
          {sentiment && (
            <div className="space-y-3">
              {/* Overall sentiment */}
              <div className="bg-gray-800/50 rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Overall</span>
                  <span className={`text-lg font-bold ${getSentimentColor(sentiment.score)}`}>
                    {getSentimentLabel(sentiment.score)}
                  </span>
                </div>
                
                {/* Sentiment bar */}
                <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`absolute h-full transition-all ${
                      sentiment.score >= 0 ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.abs(sentiment.score) * 50}%`,
                      left: sentiment.score >= 0 ? '50%' : `${50 - Math.abs(sentiment.score) * 50}%`,
                    }}
                  />
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-400" />
                </div>

                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Bearish</span>
                  <span>Neutral</span>
                  <span>Bullish</span>
                </div>
              </div>

              {/* Source breakdown */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-2">Sources ({sentiment.volume} mentions)</div>
                <div className="space-y-1">
                  {Object.entries(sentiment.sources).map(([source, score]) => (
                    <div key={source} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-gray-400">{source}</span>
                      <span className={getSentimentColor(score as number)}>
                        {(score as number) >= 0 ? '+' : ''}{((score as number) * 100).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confidence */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Confidence</span>
                  <span className="text-sm font-semibold">
                    {(sentiment.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${sentiment.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Trading Signals */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <h4 className="text-sm font-semibold text-gray-400 mb-3">AI Trading Signals</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-600/10 border border-green-600/30 rounded p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">Buy Signal</div>
            <div className="text-2xl font-bold text-green-500">72%</div>
          </div>
          <div className="bg-gray-600/10 border border-gray-600/30 rounded p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">Hold Signal</div>
            <div className="text-2xl font-bold text-gray-400">18%</div>
          </div>
          <div className="bg-red-600/10 border border-red-600/30 rounded p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">Sell Signal</div>
            <div className="text-2xl font-bold text-red-500">10%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
