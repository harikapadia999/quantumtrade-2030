/**
 * K6 Load Testing Script for QuantumTrade 2030
 * Tests API performance under various load conditions
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const orderLatency = new Trend('order_latency');
const ordersSubmitted = new Counter('orders_submitted');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 500 },   // Ramp up to 500 users
    { duration: '5m', target: 500 },   // Stay at 500 users
    { duration: '2m', target: 1000 },  // Ramp up to 1000 users
    { duration: '5m', target: 1000 },  // Stay at 1000 users
    { duration: '2m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'],                  // Error rate < 1%
    errors: ['rate<0.05'],                           // Custom error rate < 5%
    order_latency: ['p(95)<100', 'p(99)<500'],      // Order latency targets
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// Test data
const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AAPL', 'TSLA'];
const sides = ['buy', 'sell'];
const orderTypes = ['market', 'limit'];

// Setup function - runs once per VU
export function setup() {
  // Login and get auth token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'test@quantumtrade.io',
    password: 'TestPassword123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });

  const token = loginRes.json('accessToken');
  return { token };
}

// Main test function
export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // Test 1: Get market data
  const marketDataRes = http.get(
    `${BASE_URL}/api/market-data/ticker/${randomElement(symbols)}`,
    { headers }
  );

  check(marketDataRes, {
    'market data status 200': (r) => r.status === 200,
    'market data has price': (r) => r.json('ticker.price') !== undefined,
  });

  errorRate.add(marketDataRes.status !== 200);

  sleep(0.5);

  // Test 2: Get orderbook
  const orderbookRes = http.get(
    `${BASE_URL}/api/market-data/orderbook/${randomElement(symbols)}`,
    { headers }
  );

  check(orderbookRes, {
    'orderbook status 200': (r) => r.status === 200,
    'orderbook has bids': (r) => r.json('orderbook.bids') !== undefined,
    'orderbook has asks': (r) => r.json('orderbook.asks') !== undefined,
  });

  errorRate.add(orderbookRes.status !== 200);

  sleep(0.5);

  // Test 3: Submit order
  const orderData = {
    symbol: randomElement(symbols),
    side: randomElement(sides),
    type: randomElement(orderTypes),
    quantity: Math.random() * 0.1,
    price: orderTypes[0] === 'limit' ? 50000 + Math.random() * 1000 : undefined,
    leverage: Math.floor(Math.random() * 5) + 1,
  };

  const orderStart = Date.now();
  const orderRes = http.post(
    `${BASE_URL}/api/trading/orders`,
    JSON.stringify(orderData),
    { headers }
  );
  const orderDuration = Date.now() - orderStart;

  check(orderRes, {
    'order submitted': (r) => r.status === 201 || r.status === 200,
    'order has id': (r) => r.json('orderId') !== undefined,
  });

  errorRate.add(orderRes.status !== 201 && orderRes.status !== 200);
  orderLatency.add(orderDuration);
  ordersSubmitted.add(1);

  sleep(1);

  // Test 4: Get portfolio
  const portfolioRes = http.get(`${BASE_URL}/api/portfolio`, { headers });

  check(portfolioRes, {
    'portfolio status 200': (r) => r.status === 200,
    'portfolio has equity': (r) => r.json('portfolio.totalEquity') !== undefined,
  });

  errorRate.add(portfolioRes.status !== 200);

  sleep(0.5);

  // Test 5: Get positions
  const positionsRes = http.get(`${BASE_URL}/api/portfolio/positions`, { headers });

  check(positionsRes, {
    'positions status 200': (r) => r.status === 200,
  });

  errorRate.add(positionsRes.status !== 200);

  sleep(1);

  // Test 6: Get AI predictions
  const predictionRes = http.post(
    `${BASE_URL}/api/ai/predictions/${randomElement(symbols)}`,
    null,
    { headers }
  );

  check(predictionRes, {
    'prediction status 200': (r) => r.status === 200,
    'prediction has data': (r) => r.json('predictions') !== undefined,
  });

  errorRate.add(predictionRes.status !== 200);

  sleep(2);
}

// Teardown function
export function teardown(data) {
  // Logout
  http.post(`${BASE_URL}/api/auth/logout`, null, {
    headers: {
      'Authorization': `Bearer ${data.token}`,
    },
  });
}

// Helper functions
function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}
