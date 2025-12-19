"""
Real-time Sentiment Analysis for Trading
Analyzes news, social media, and on-chain data for market sentiment
"""

import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from typing import Dict, List, Tuple
import numpy as np
from dataclasses import dataclass
from datetime import datetime
import asyncio
import aiohttp


@dataclass
class SentimentScore:
    """Sentiment analysis result"""
    symbol: str
    sentiment: float  # -1 (bearish) to +1 (bullish)
    confidence: float
    sources: Dict[str, float]  # Source-specific sentiments
    timestamp: datetime
    volume: int  # Number of mentions


class MultiSourceSentimentAnalyzer:
    """
    Analyzes sentiment from multiple sources:
    - News articles (Bloomberg, Reuters, CoinDesk)
    - Social media (Twitter, Reddit, Discord)
    - On-chain metrics
    - Analyst reports
    """
    
    def __init__(self, model_name: str = "ProsusAI/finbert"):
        """
        Initialize sentiment analyzer
        
        Args:
            model_name: HuggingFace model for financial sentiment
        """
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Load FinBERT for financial sentiment
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.model.to(self.device)
        self.model.eval()
        
        # Source weights (how much to trust each source)
        self.source_weights = {
            'bloomberg': 1.0,
            'reuters': 1.0,
            'coindesk': 0.8,
            'twitter': 0.5,
            'reddit': 0.6,
            'discord': 0.4,
            'onchain': 0.9,
        }
    
    async def analyze_text(self, text: str) -> Tuple[float, float]:
        """
        Analyze sentiment of a single text
        
        Args:
            text: Text to analyze
        
        Returns:
            Tuple of (sentiment_score, confidence)
        """
        # Tokenize
        inputs = self.tokenizer(
            text,
            return_tensors='pt',
            truncation=True,
            max_length=512,
            padding=True
        ).to(self.device)
        
        # Get prediction
        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1)
        
        # FinBERT outputs: [negative, neutral, positive]
        negative, neutral, positive = probs[0].cpu().numpy()
        
        # Convert to -1 to +1 scale
        sentiment = positive - negative
        confidence = max(positive, negative)
        
        return float(sentiment), float(confidence)
    
    async def fetch_news(self, symbol: str, sources: List[str]) -> List[Dict]:
        """Fetch news articles from various sources"""
        articles = []
        
        # In production, integrate with real APIs
        # Bloomberg API, Reuters API, NewsAPI, etc.
        
        # Placeholder implementation
        async with aiohttp.ClientSession() as session:
            for source in sources:
                # Fetch from each source
                # articles.extend(await self._fetch_from_source(session, source, symbol))
                pass
        
        return articles
    
    async def fetch_social_media(self, symbol: str) -> List[Dict]:
        """Fetch social media mentions"""
        mentions = []
        
        # Twitter API v2
        # Reddit API (PRAW)
        # Discord webhooks
        
        return mentions
    
    async def fetch_onchain_metrics(self, symbol: str) -> Dict:
        """Fetch on-chain metrics for crypto assets"""
        metrics = {}
        
        if symbol.endswith('-USD') or symbol.endswith('-USDT'):
            # Fetch from The Graph, Dune Analytics, etc.
            # - Transaction volume
            # - Active addresses
            # - Whale movements
            # - Exchange inflows/outflows
            pass
        
        return metrics
    
    async def analyze_symbol(self, symbol: str) -> SentimentScore:
        """
        Comprehensive sentiment analysis for a symbol
        
        Args:
            symbol: Trading symbol (e.g., 'BTC-USD', 'AAPL')
        
        Returns:
            SentimentScore with aggregated sentiment
        """
        # Fetch data from all sources
        news_articles = await self.fetch_news(symbol, ['bloomberg', 'reuters', 'coindesk'])
        social_mentions = await self.fetch_social_media(symbol)
        onchain_data = await self.fetch_onchain_metrics(symbol)
        
        # Analyze each source
        source_sentiments = {}
        
        # News sentiment
        if news_articles:
            news_scores = []
            for article in news_articles:
                sentiment, confidence = await self.analyze_text(article['text'])
                news_scores.append(sentiment * confidence)
            source_sentiments['news'] = np.mean(news_scores) if news_scores else 0.0
        
        # Social media sentiment
        if social_mentions:
            social_scores = []
            for mention in social_mentions:
                sentiment, confidence = await self.analyze_text(mention['text'])
                # Weight by follower count or engagement
                weight = mention.get('engagement', 1.0)
                social_scores.append(sentiment * confidence * weight)
            source_sentiments['social'] = np.mean(social_scores) if social_scores else 0.0
        
        # On-chain sentiment (for crypto)
        if onchain_data:
            onchain_sentiment = self._analyze_onchain_metrics(onchain_data)
            source_sentiments['onchain'] = onchain_sentiment
        
        # Aggregate sentiments with weights
        weighted_sum = 0.0
        total_weight = 0.0
        
        for source, sentiment in source_sentiments.items():
            weight = self.source_weights.get(source, 0.5)
            weighted_sum += sentiment * weight
            total_weight += weight
        
        final_sentiment = weighted_sum / total_weight if total_weight > 0 else 0.0
        
        # Calculate confidence based on agreement between sources
        confidence = self._calculate_confidence(source_sentiments)
        
        return SentimentScore(
            symbol=symbol,
            sentiment=final_sentiment,
            confidence=confidence,
            sources=source_sentiments,
            timestamp=datetime.utcnow(),
            volume=len(news_articles) + len(social_mentions)
        )
    
    def _analyze_onchain_metrics(self, metrics: Dict) -> float:
        """Convert on-chain metrics to sentiment score"""
        sentiment = 0.0
        
        # Positive indicators
        if metrics.get('active_addresses_growth', 0) > 0.1:
            sentiment += 0.2
        if metrics.get('transaction_volume_growth', 0) > 0.1:
            sentiment += 0.2
        
        # Negative indicators
        if metrics.get('exchange_inflow', 0) > metrics.get('exchange_outflow', 0) * 1.5:
            sentiment -= 0.3  # Large exchange inflows = selling pressure
        
        # Whale activity
        whale_sentiment = metrics.get('whale_sentiment', 0)
        sentiment += whale_sentiment * 0.3
        
        return np.clip(sentiment, -1.0, 1.0)
    
    def _calculate_confidence(self, source_sentiments: Dict[str, float]) -> float:
        """Calculate confidence based on agreement between sources"""
        if len(source_sentiments) < 2:
            return 0.5
        
        sentiments = list(source_sentiments.values())
        
        # High confidence if sources agree
        std_dev = np.std(sentiments)
        agreement = 1.0 - min(std_dev, 1.0)
        
        # Also consider number of sources
        source_factor = min(len(sentiments) / 5.0, 1.0)
        
        return (agreement * 0.7 + source_factor * 0.3)
    
    async def get_market_sentiment(self, symbols: List[str]) -> Dict[str, SentimentScore]:
        """
        Get sentiment for multiple symbols
        
        Args:
            symbols: List of trading symbols
        
        Returns:
            Dictionary mapping symbols to sentiment scores
        """
        tasks = [self.analyze_symbol(symbol) for symbol in symbols]
        results = await asyncio.gather(*tasks)
        
        return {result.symbol: result for result in results}


class SentimentSignalGenerator:
    """
    Generates trading signals from sentiment analysis
    """
    
    def __init__(self, analyzer: MultiSourceSentimentAnalyzer):
        self.analyzer = analyzer
    
    def generate_signal(self, sentiment: SentimentScore) -> Dict:
        """
        Generate trading signal from sentiment
        
        Returns:
            Dictionary with signal, strength, and reasoning
        """
        signal = 'neutral'
        strength = 0.0
        reasoning = []
        
        # Strong bullish
        if sentiment.sentiment > 0.5 and sentiment.confidence > 0.7:
            signal = 'strong_buy'
            strength = sentiment.sentiment * sentiment.confidence
            reasoning.append(f"Strong positive sentiment ({sentiment.sentiment:.2f})")
        
        # Moderate bullish
        elif sentiment.sentiment > 0.2 and sentiment.confidence > 0.5:
            signal = 'buy'
            strength = sentiment.sentiment * sentiment.confidence * 0.7
            reasoning.append(f"Positive sentiment ({sentiment.sentiment:.2f})")
        
        # Strong bearish
        elif sentiment.sentiment < -0.5 and sentiment.confidence > 0.7:
            signal = 'strong_sell'
            strength = abs(sentiment.sentiment) * sentiment.confidence
            reasoning.append(f"Strong negative sentiment ({sentiment.sentiment:.2f})")
        
        # Moderate bearish
        elif sentiment.sentiment < -0.2 and sentiment.confidence > 0.5:
            signal = 'sell'
            strength = abs(sentiment.sentiment) * sentiment.confidence * 0.7
            reasoning.append(f"Negative sentiment ({sentiment.sentiment:.2f})")
        
        # Check for divergence between sources
        if sentiment.sources:
            source_values = list(sentiment.sources.values())
            if max(source_values) - min(source_values) > 1.0:
                reasoning.append("Warning: High divergence between sources")
                strength *= 0.7
        
        # Volume consideration
        if sentiment.volume < 10:
            reasoning.append("Warning: Low mention volume")
            strength *= 0.8
        
        return {
            'signal': signal,
            'strength': strength,
            'sentiment': sentiment.sentiment,
            'confidence': sentiment.confidence,
            'reasoning': reasoning,
            'sources': sentiment.sources,
            'timestamp': sentiment.timestamp.isoformat()
        }


async def main():
    """Example usage"""
    analyzer = MultiSourceSentimentAnalyzer()
    signal_generator = SentimentSignalGenerator(analyzer)
    
    # Analyze multiple symbols
    symbols = ['BTC-USD', 'ETH-USD', 'AAPL', 'TSLA']
    
    print("Analyzing market sentiment...")
    sentiments = await analyzer.get_market_sentiment(symbols)
    
    print("\n" + "="*60)
    print("SENTIMENT ANALYSIS RESULTS")
    print("="*60)
    
    for symbol, sentiment in sentiments.items():
        signal = signal_generator.generate_signal(sentiment)
        
        print(f"\n{symbol}")
        print(f"  Sentiment: {sentiment.sentiment:+.3f}")
        print(f"  Confidence: {sentiment.confidence:.3f}")
        print(f"  Signal: {signal['signal'].upper()}")
        print(f"  Strength: {signal['strength']:.3f}")
        print(f"  Volume: {sentiment.volume} mentions")
        print(f"  Sources:")
        for source, score in sentiment.sources.items():
            print(f"    - {source}: {score:+.3f}")
        if signal['reasoning']:
            print(f"  Reasoning:")
            for reason in signal['reasoning']:
                print(f"    - {reason}")


if __name__ == '__main__':
    asyncio.run(main())
