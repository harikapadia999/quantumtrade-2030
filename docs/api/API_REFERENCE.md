# QuantumTrade 2030 - API Reference

## Base URL
```
Production: https://api.quantumtrade.io
Staging: https://api-staging.quantumtrade.io
Development: http://localhost:3000
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_access_token>
```

### Endpoints

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "uuid",
  "message": "Registration successful. Please verify your email."
}
```

#### POST /api/auth/login
Login to existing account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
```

## Trading API

### POST /api/trading/orders
Submit a new order.

**Authentication:** Required

**Request Body:**
```json
{
  "symbol": "BTC-USD",
  "side": "buy",
  "type": "limit",
  "quantity": 0.5,
  "price": 50000,
  "leverage": 5,
  "timeInForce": "GTC"
}
```

**Parameters:**
- `symbol` (string, required): Trading pair (e.g., "BTC-USD", "ETH-USD")
- `side` (string, required): "buy" or "sell"
- `type` (string, required): "market", "limit", "stop_loss", "stop_limit"
- `quantity` (number, required): Order quantity
- `price` (number, optional): Limit price (required for limit orders)
- `stopPrice` (number, optional): Stop price (required for stop orders)
- `leverage` (number, optional): Leverage multiplier (1-10, default: 1)
- `timeInForce` (string, optional): "GTC", "IOC", "FOK", "GTD" (default: "GTC")
- `reduceOnly` (boolean, optional): Only reduce position (default: false)
- `postOnly` (boolean, optional): Only add liquidity (default: false)

**Response:**
```json
{
  "success": true,
  "orderId": "uuid",
  "order": {
    "id": "uuid",
    "symbol": "BTC-USD",
    "side": "buy",
    "type": "limit",
    "quantity": 0.5,
    "price": 50000,
    "status": "pending",
    "createdAt": "2025-12-18T10:00:00Z"
  }
}
```

### GET /api/trading/orders
Get user's orders.

**Authentication:** Required

**Query Parameters:**
- `symbol` (string, optional): Filter by symbol
- `status` (string, optional): Filter by status
- `side` (string, optional): Filter by side
- `limit` (number, optional): Results per page (default: 20, max: 100)
- `offset` (number, optional): Pagination offset (default: 0)
- `startDate` (string, optional): ISO 8601 date
- `endDate` (string, optional): ISO 8601 date

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": "uuid",
      "symbol": "BTC-USD",
      "side": "buy",
      "type": "limit",
      "quantity": 0.5,
      "price": 50000,
      "filledQuantity": 0.3,
      "status": "partially_filled",
      "createdAt": "2025-12-18T10:00:00Z"
    }
  ],
  "total": 1
}
```

### DELETE /api/trading/orders/:orderId
Cancel an order.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Order cancelled successfully"
}
```

### GET /api/trading/positions
Get user's open positions.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "positions": [
    {
      "id": "uuid",
      "symbol": "BTC-USD",
      "quantity": 0.5,
      "averageEntryPrice": 49500,
      "currentPrice": 50000,
      "unrealizedPnl": 250,
      "marginUsed": 5000,
      "leverage": 5,
      "liquidationPrice": 45000
    }
  ]
}
```

### POST /api/trading/positions/:symbol/close
Close a position.

**Authentication:** Required

**Request Body:**
```json
{
  "quantity": 0.5,
  "price": 50000
}
```

## Market Data API

### GET /api/market-data/ticker/:symbol
Get ticker data for a symbol.

**Authentication:** Optional

**Response:**
```json
{
  "success": true,
  "ticker": {
    "symbol": "BTC-USD",
    "price": 50000,
    "change24h": 2.5,
    "volume24h": 1000000000,
    "high24h": 51000,
    "low24h": 49000,
    "marketCap": 1000000000000,
    "timestamp": 1702900000
  }
}
```

### GET /api/market-data/candles
Get candlestick data.

**Authentication:** Optional

**Query Parameters:**
- `symbol` (string, required): Trading pair
- `interval` (string, required): "1m", "5m", "15m", "1h", "4h", "1d"
- `limit` (number, optional): Number of candles (default: 100, max: 1000)
- `startTime` (string, optional): ISO 8601 date
- `endTime` (string, optional): ISO 8601 date

**Response:**
```json
{
  "success": true,
  "candles": [
    {
      "timestamp": 1702900000,
      "open": 49900,
      "high": 50100,
      "low": 49800,
      "close": 50000,
      "volume": 1000
    }
  ]
}
```

### GET /api/market-data/orderbook/:symbol
Get orderbook for a symbol.

**Authentication:** Optional

**Response:**
```json
{
  "success": true,
  "orderbook": {
    "symbol": "BTC-USD",
    "bids": [
      [49900, 1.5],
      [49800, 2.0]
    ],
    "asks": [
      [50100, 1.2],
      [50200, 2.5]
    ],
    "timestamp": 1702900000
  }
}
```

## Portfolio API

### GET /api/portfolio
Get user's portfolio.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "portfolio": {
    "totalEquity": 100000,
    "cashBalance": 50000,
    "totalMarginUsed": 10000,
    "availableMargin": 40000,
    "totalUnrealizedPnl": 5000,
    "totalRealizedPnl": 2000,
    "positions": 3
  }
}
```

### GET /api/portfolio/history
Get portfolio value history.

**Authentication:** Required

**Query Parameters:**
- `period` (string, optional): "1d", "7d", "30d", "90d", "1y", "all" (default: "30d")
- `interval` (string, optional): "1h", "1d", "1w" (default: "1d")

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "timestamp": "2025-12-18T00:00:00Z",
      "value": 98000
    },
    {
      "timestamp": "2025-12-19T00:00:00Z",
      "value": 100000
    }
  ]
}
```

### GET /api/portfolio/performance
Get portfolio performance metrics.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "performance": {
    "totalReturn": 15.5,
    "totalReturnPercent": 15.5,
    "sharpeRatio": 1.8,
    "maxDrawdown": 8.2,
    "winRate": 65.5,
    "profitFactor": 2.1,
    "averageWin": 500,
    "averageLoss": 250
  }
}
```

## AI/ML API

### POST /api/ai/predictions/:symbol
Get AI price predictions.

**Authentication:** Optional

**Response:**
```json
{
  "success": true,
  "predictions": {
    "horizon_1": {
      "price_change_pct": 2.5,
      "confidence": 0.85,
      "direction": "up"
    },
    "horizon_5": {
      "price_change_pct": 5.2,
      "confidence": 0.75,
      "direction": "up"
    }
  },
  "timestamp": "2025-12-18T10:00:00Z"
}
```

### POST /api/ai/sentiment/:symbol
Get sentiment analysis.

**Authentication:** Optional

**Response:**
```json
{
  "success": true,
  "sentiment": {
    "score": 0.65,
    "confidence": 0.80,
    "sources": {
      "news": 0.70,
      "social": 0.60,
      "onchain": 0.65
    },
    "signal": "buy",
    "strength": 0.52,
    "volume": 1250
  },
  "timestamp": "2025-12-18T10:00:00Z"
}
```

## WebSocket API

### Connection
```javascript
const socket = io('wss://api.quantumtrade.io', {
  auth: { token: 'your_access_token' }
});
```

### Subscribe to Market Data
```javascript
socket.emit('subscribe:market', { symbol: 'BTC-USD' });

socket.on('market:update', (data) => {
  console.log('Market update:', data);
});
```

### Subscribe to Orderbook
```javascript
socket.emit('subscribe:orderbook', { symbol: 'BTC-USD' });

socket.on('orderbook:update', (data) => {
  console.log('Orderbook update:', data);
});
```

### Subscribe to User Orders
```javascript
socket.emit('subscribe:orders');

socket.on('order:update', (data) => {
  console.log('Order update:', data);
});
```

### Subscribe to Portfolio
```javascript
socket.emit('subscribe:portfolio');

socket.on('portfolio:update', (data) => {
  console.log('Portfolio update:', data);
});
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "statusCode": 400,
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Common Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **Authenticated**: 1000 requests per 15 minutes per user
- **WebSocket**: 10 subscriptions per connection

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1702900000
```

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `limit` - Results per page (default: 20, max: 100)
- `offset` - Number of results to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [...],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

## Versioning

API version is included in the URL:
```
https://api.quantumtrade.io/v1/...
```

Current version: **v1**

## SDKs

Official SDKs available for:
- JavaScript/TypeScript
- Python
- Go
- Rust
- Java

## Support

- **Documentation**: https://docs.quantumtrade.io
- **API Status**: https://status.quantumtrade.io
- **Support**: support@quantumtrade.io
