import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { tradingRouter } from './routes/trading';
import { marketDataRouter } from './routes/marketData';
import { portfolioRouter } from './routes/portfolio';
import { userRouter } from './routes/user';
import { webhookRouter } from './routes/webhooks';
import { setupWebSocket } from './websocket';
import { connectDatabase } from './database';
import { connectRedis } from './cache';
import { initializeKafka } from './messaging/kafka';
import { setupMetrics } from './monitoring/metrics';

class APIGateway {
  private app: Application;
  private httpServer: any;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: config.cors.origin,
        credentials: true,
      },
    });
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: true,
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    this.app.use(morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) },
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });
    this.app.use('/api/', limiter);

    // Metrics
    setupMetrics(this.app);
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // API routes
    this.app.use('/api/auth', authRouter);
    this.app.use('/api/trading', tradingRouter);
    this.app.use('/api/market-data', marketDataRouter);
    this.app.use('/api/portfolio', portfolioRouter);
    this.app.use('/api/user', userRouter);
    this.app.use('/api/webhooks', webhookRouter);

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });

    // Error handler
    this.app.use(errorHandler);
  }

  private async initializeServices(): Promise<void> {
    try {
      // Connect to database
      await connectDatabase();
      logger.info('Database connected');

      // Connect to Redis
      await connectRedis();
      logger.info('Redis connected');

      // Initialize Kafka
      await initializeKafka();
      logger.info('Kafka initialized');

      // Setup WebSocket
      setupWebSocket(this.io);
      logger.info('WebSocket initialized');

    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      // Setup middleware and routes
      this.setupMiddleware();
      this.setupRoutes();

      // Initialize services
      await this.initializeServices();

      // Start server
      const port = config.port || 3000;
      this.httpServer.listen(port, () => {
        logger.info(`🚀 QuantumTrade API Gateway running on port ${port}`);
        logger.info(`Environment: ${config.env}`);
        logger.info(`WebSocket enabled on ws://localhost:${port}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      logger.error('Failed to start API Gateway:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    logger.info('Shutting down gracefully...');
    
    this.httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  }
}

// Start the server
const gateway = new APIGateway();
gateway.start();

export default gateway;
