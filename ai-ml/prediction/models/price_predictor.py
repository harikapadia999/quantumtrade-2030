"""
Price Prediction Model using Transformer Architecture
Predicts future price movements for multiple time horizons
"""

import torch
import torch.nn as nn
import numpy as np
from typing import Dict, List, Tuple
import pandas as pd
from dataclasses import dataclass


@dataclass
class PredictionConfig:
    """Configuration for price prediction model"""
    input_dim: int = 128
    hidden_dim: int = 512
    num_layers: int = 6
    num_heads: int = 8
    dropout: float = 0.1
    max_seq_length: int = 1000
    prediction_horizons: List[int] = None  # [1, 5, 15, 60, 240, 1440] minutes
    
    def __post_init__(self):
        if self.prediction_horizons is None:
            self.prediction_horizons = [1, 5, 15, 60, 240, 1440]


class PositionalEncoding(nn.Module):
    """Positional encoding for transformer"""
    
    def __init__(self, d_model: int, max_len: int = 5000):
        super().__init__()
        position = torch.arange(max_len).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2) * (-np.log(10000.0) / d_model))
        pe = torch.zeros(max_len, 1, d_model)
        pe[:, 0, 0::2] = torch.sin(position * div_term)
        pe[:, 0, 1::2] = torch.cos(position * div_term)
        self.register_buffer('pe', pe)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.pe[:x.size(0)]


class MultiHorizonPricePredictor(nn.Module):
    """
    Transformer-based model for multi-horizon price prediction
    Predicts price changes for multiple time horizons simultaneously
    """
    
    def __init__(self, config: PredictionConfig):
        super().__init__()
        self.config = config
        
        # Input embedding
        self.input_projection = nn.Linear(config.input_dim, config.hidden_dim)
        self.pos_encoder = PositionalEncoding(config.hidden_dim, config.max_seq_length)
        
        # Transformer encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=config.hidden_dim,
            nhead=config.num_heads,
            dim_feedforward=config.hidden_dim * 4,
            dropout=config.dropout,
            activation='gelu',
            batch_first=True
        )
        self.transformer_encoder = nn.TransformerEncoder(
            encoder_layer,
            num_layers=config.num_layers
        )
        
        # Multi-horizon prediction heads
        self.prediction_heads = nn.ModuleDict({
            f'horizon_{h}': nn.Sequential(
                nn.Linear(config.hidden_dim, config.hidden_dim // 2),
                nn.GELU(),
                nn.Dropout(config.dropout),
                nn.Linear(config.hidden_dim // 2, 3)  # [price_change, confidence, volatility]
            )
            for h in config.prediction_horizons
        })
        
        # Uncertainty estimation
        self.uncertainty_head = nn.Sequential(
            nn.Linear(config.hidden_dim, config.hidden_dim // 2),
            nn.GELU(),
            nn.Linear(config.hidden_dim // 2, 1),
            nn.Softplus()
        )
    
    def forward(self, x: torch.Tensor, mask: torch.Tensor = None) -> Dict[str, torch.Tensor]:
        """
        Forward pass
        
        Args:
            x: Input tensor [batch, seq_len, input_dim]
            mask: Attention mask [batch, seq_len]
        
        Returns:
            Dictionary with predictions for each horizon
        """
        # Project input
        x = self.input_projection(x)
        x = self.pos_encoder(x.transpose(0, 1)).transpose(0, 1)
        
        # Transformer encoding
        encoded = self.transformer_encoder(x, src_key_padding_mask=mask)
        
        # Use last token for prediction
        last_hidden = encoded[:, -1, :]
        
        # Multi-horizon predictions
        predictions = {}
        for horizon, head in self.prediction_heads.items():
            pred = head(last_hidden)
            predictions[horizon] = {
                'price_change': pred[:, 0],
                'confidence': torch.sigmoid(pred[:, 1]),
                'volatility': torch.exp(pred[:, 2])
            }
        
        # Uncertainty estimation
        predictions['uncertainty'] = self.uncertainty_head(last_hidden).squeeze(-1)
        
        return predictions


class FeatureExtractor:
    """Extract features from raw market data"""
    
    @staticmethod
    def extract_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
        """Extract technical indicators from OHLCV data"""
        
        # Price-based features
        df['returns'] = df['close'].pct_change()
        df['log_returns'] = np.log(df['close'] / df['close'].shift(1))
        
        # Moving averages
        for period in [5, 10, 20, 50, 200]:
            df[f'sma_{period}'] = df['close'].rolling(period).mean()
            df[f'ema_{period}'] = df['close'].ewm(span=period).mean()
        
        # Volatility
        df['volatility_20'] = df['returns'].rolling(20).std()
        df['atr_14'] = FeatureExtractor._calculate_atr(df, 14)
        
        # Momentum indicators
        df['rsi_14'] = FeatureExtractor._calculate_rsi(df['close'], 14)
        df['macd'], df['macd_signal'] = FeatureExtractor._calculate_macd(df['close'])
        
        # Volume indicators
        df['volume_sma_20'] = df['volume'].rolling(20).mean()
        df['volume_ratio'] = df['volume'] / df['volume_sma_20']
        
        # Bollinger Bands
        df['bb_middle'] = df['close'].rolling(20).mean()
        bb_std = df['close'].rolling(20).std()
        df['bb_upper'] = df['bb_middle'] + (bb_std * 2)
        df['bb_lower'] = df['bb_middle'] - (bb_std * 2)
        df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle']
        
        return df
    
    @staticmethod
    def _calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
        """Calculate Relative Strength Index"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))
    
    @staticmethod
    def _calculate_macd(prices: pd.Series, fast=12, slow=26, signal=9) -> Tuple[pd.Series, pd.Series]:
        """Calculate MACD and signal line"""
        ema_fast = prices.ewm(span=fast).mean()
        ema_slow = prices.ewm(span=slow).mean()
        macd = ema_fast - ema_slow
        macd_signal = macd.ewm(span=signal).mean()
        return macd, macd_signal
    
    @staticmethod
    def _calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate Average True Range"""
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = ranges.max(axis=1)
        return true_range.rolling(period).mean()


class PricePredictionService:
    """Service for making price predictions"""
    
    def __init__(self, model: MultiHorizonPricePredictor, device: str = 'cuda'):
        self.model = model.to(device)
        self.device = device
        self.feature_extractor = FeatureExtractor()
    
    def predict(self, market_data: pd.DataFrame) -> Dict[str, Dict[str, float]]:
        """
        Make price predictions for multiple horizons
        
        Args:
            market_data: DataFrame with OHLCV data
        
        Returns:
            Dictionary with predictions for each horizon
        """
        # Extract features
        features_df = self.feature_extractor.extract_technical_indicators(market_data)
        
        # Prepare input tensor
        feature_columns = [col for col in features_df.columns if col not in ['timestamp', 'symbol']]
        features = features_df[feature_columns].fillna(0).values
        
        # Normalize features
        features = (features - features.mean(axis=0)) / (features.std(axis=0) + 1e-8)
        
        # Convert to tensor
        x = torch.FloatTensor(features).unsqueeze(0).to(self.device)
        
        # Make prediction
        self.model.eval()
        with torch.no_grad():
            predictions = self.model(x)
        
        # Format results
        results = {}
        for horizon, pred in predictions.items():
            if horizon != 'uncertainty':
                results[horizon] = {
                    'price_change_pct': pred['price_change'].item() * 100,
                    'confidence': pred['confidence'].item(),
                    'volatility': pred['volatility'].item(),
                    'direction': 'up' if pred['price_change'].item() > 0 else 'down'
                }
        
        results['overall_uncertainty'] = predictions['uncertainty'].item()
        
        return results


if __name__ == '__main__':
    # Example usage
    config = PredictionConfig()
    model = MultiHorizonPricePredictor(config)
    
    print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
    print(f"Prediction horizons: {config.prediction_horizons}")
    
    # Test forward pass
    batch_size = 4
    seq_len = 100
    x = torch.randn(batch_size, seq_len, config.input_dim)
    
    predictions = model(x)
    print("\nPrediction shapes:")
    for horizon, pred in predictions.items():
        if horizon != 'uncertainty':
            print(f"{horizon}: {pred['price_change'].shape}")
