"""
AI/ML Prediction Service
FastAPI service for price predictions and sentiment analysis
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import torch
import asyncio
from datetime import datetime
import uvicorn

from models.price_predictor import (
    MultiHorizonPricePredictor,
    PredictionConfig,
    PricePredictionService,
)
from sentiment.sentiment_analyzer import (
    MultiSourceSentimentAnalyzer,
    SentimentSignalGenerator,
)

app = FastAPI(
    title="QuantumTrade AI/ML Service",
    description="Price prediction and sentiment analysis for trading",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize models
prediction_config = PredictionConfig()
prediction_model = MultiHorizonPricePredictor(prediction_config)
prediction_service = PricePredictionService(prediction_model)

sentiment_analyzer = MultiSourceSentimentAnalyzer()
signal_generator = SentimentSignalGenerator(sentiment_analyzer)

# Request/Response models
class PredictionRequest(BaseModel):
    symbol: str
    horizons: Optional[List[str]] = None

class PredictionResponse(BaseModel):
    symbol: str
    predictions: Dict[str, Dict[str, float]]
    timestamp: str

class SentimentRequest(BaseModel):
    symbol: str

class SentimentResponse(BaseModel):
    symbol: str
    sentiment: float
    confidence: float
    sources: Dict[str, float]
    signal: str
    strength: float
    timestamp: str

class BatchPredictionRequest(BaseModel):
    symbols: List[str]

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "model_loaded": prediction_model is not None,
        "device": str(prediction_service.device),
    }

# Price prediction endpoints
@app.post("/predict", response_model=PredictionResponse)
async def predict_price(request: PredictionRequest):
    """
    Get price predictions for a symbol
    """
    try:
        # Fetch market data (would integrate with market data service)
        market_data = await fetch_market_data(request.symbol)
        
        # Make prediction
        predictions = prediction_service.predict(market_data)
        
        return PredictionResponse(
            symbol=request.symbol,
            predictions=predictions,
            timestamp=datetime.utcnow().isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/batch")
async def predict_batch(request: BatchPredictionRequest):
    """
    Get predictions for multiple symbols
    """
    try:
        tasks = [predict_price(PredictionRequest(symbol=symbol)) for symbol in request.symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        predictions = {}
        for symbol, result in zip(request.symbols, results):
            if isinstance(result, Exception):
                predictions[symbol] = {"error": str(result)}
            else:
                predictions[symbol] = result.predictions
        
        return {
            "predictions": predictions,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Sentiment analysis endpoints
@app.post("/sentiment", response_model=SentimentResponse)
async def analyze_sentiment(request: SentimentRequest):
    """
    Get sentiment analysis for a symbol
    """
    try:
        # Analyze sentiment
        sentiment_score = await sentiment_analyzer.analyze_symbol(request.symbol)
        
        # Generate trading signal
        signal = signal_generator.generate_signal(sentiment_score)
        
        return SentimentResponse(
            symbol=request.symbol,
            sentiment=sentiment_score.sentiment,
            confidence=sentiment_score.confidence,
            sources=sentiment_score.sources,
            signal=signal['signal'],
            strength=signal['strength'],
            timestamp=sentiment_score.timestamp.isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sentiment/batch")
async def analyze_sentiment_batch(request: BatchPredictionRequest):
    """
    Get sentiment analysis for multiple symbols
    """
    try:
        sentiments = await sentiment_analyzer.get_market_sentiment(request.symbols)
        
        results = {}
        for symbol, sentiment in sentiments.items():
            signal = signal_generator.generate_signal(sentiment)
            results[symbol] = {
                "sentiment": sentiment.sentiment,
                "confidence": sentiment.confidence,
                "signal": signal['signal'],
                "strength": signal['strength'],
            }
        
        return {
            "sentiments": results,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Model management endpoints
@app.post("/model/reload")
async def reload_model(background_tasks: BackgroundTasks):
    """
    Reload prediction model
    """
    try:
        background_tasks.add_task(load_model)
        return {"message": "Model reload initiated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/model/info")
async def get_model_info():
    """
    Get model information
    """
    return {
        "model_type": "MultiHorizonPricePredictor",
        "parameters": sum(p.numel() for p in prediction_model.parameters()),
        "horizons": prediction_config.prediction_horizons,
        "device": str(prediction_service.device),
        "input_dim": prediction_config.input_dim,
        "hidden_dim": prediction_config.hidden_dim,
    }

# Metrics endpoint
@app.get("/metrics")
async def get_metrics():
    """
    Get service metrics
    """
    return {
        "predictions_made": 0,  # Would track in production
        "sentiment_analyses": 0,
        "average_latency_ms": 0,
        "model_accuracy": 0,
    }

# Helper functions
async def fetch_market_data(symbol: str):
    """
    Fetch market data for prediction
    In production, this would call the market data service
    """
    import pandas as pd
    import numpy as np
    
    # Placeholder - generate sample data
    dates = pd.date_range(end=datetime.now(), periods=1000, freq='1min')
    data = pd.DataFrame({
        'timestamp': dates,
        'open': np.random.randn(1000).cumsum() + 50000,
        'high': np.random.randn(1000).cumsum() + 50100,
        'low': np.random.randn(1000).cumsum() + 49900,
        'close': np.random.randn(1000).cumsum() + 50000,
        'volume': np.random.randint(1000, 10000, 1000),
    })
    
    return data

async def load_model():
    """
    Load or reload the prediction model
    """
    global prediction_model, prediction_service
    
    # In production, load from saved checkpoint
    prediction_model = MultiHorizonPricePredictor(prediction_config)
    prediction_service = PricePredictionService(prediction_model)
    
    print("Model loaded successfully")

# Startup event
@app.on_event("startup")
async def startup_event():
    print("Starting AI/ML Prediction Service...")
    print(f"Device: {prediction_service.device}")
    print(f"Model parameters: {sum(p.numel() for p in prediction_model.parameters()):,}")
    print("Service ready!")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    print("Shutting down AI/ML Prediction Service...")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8082,
        reload=True,
        log_level="info",
    )
