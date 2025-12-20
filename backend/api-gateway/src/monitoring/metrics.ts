import { Application } from 'express';
import promClient from 'prom-client';
import { logger } from '../utils/logger';

// Create a Registry
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const activeConnections = new promClient.Gauge({
  name: 'active_websocket_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const ordersSubmitted = new promClient.Counter({
  name: 'orders_submitted_total',
  help: 'Total number of orders submitted',
  labelNames: ['symbol', 'side', 'type'],
  registers: [register],
});

export const ordersExecuted = new promClient.Counter({
  name: 'orders_executed_total',
  help: 'Total number of orders executed',
  labelNames: ['symbol', 'side'],
  registers: [register],
});

export const orderExecutionTime = new promClient.Histogram({
  name: 'order_execution_time_seconds',
  help: 'Time taken to execute orders',
  labelNames: ['symbol', 'type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const tradingVolume = new promClient.Counter({
  name: 'trading_volume_total',
  help: 'Total trading volume',
  labelNames: ['symbol'],
  registers: [register],
});

export const portfolioValue = new promClient.Gauge({
  name: 'portfolio_value_usd',
  help: 'Total portfolio value in USD',
  labelNames: ['user_id'],
  registers: [register],
});

export const cacheHits = new promClient.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['key_prefix'],
  registers: [register],
});

export const cacheMisses = new promClient.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['key_prefix'],
  registers: [register],
});

export const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['query_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const kafkaMessagesSent = new promClient.Counter({
  name: 'kafka_messages_sent_total',
  help: 'Total number of Kafka messages sent',
  labelNames: ['topic'],
  registers: [register],
});

export const kafkaMessagesReceived = new promClient.Counter({
  name: 'kafka_messages_received_total',
  help: 'Total number of Kafka messages received',
  labelNames: ['topic'],
  registers: [register],
});

export const setupMetrics = (app: Application): void => {
  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } catch (error) {
      logger.error('Error generating metrics:', error);
      res.status(500).end();
    }
  });

  // Middleware to track HTTP metrics
  app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path;

      httpRequestDuration.observe(
        { method: req.method, route, status_code: res.statusCode },
        duration
      );

      httpRequestTotal.inc({
        method: req.method,
        route,
        status_code: res.statusCode,
      });
    });

    next();
  });

  logger.info('Metrics collection initialized');
};

export { register };
