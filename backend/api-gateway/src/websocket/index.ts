import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { cache } from '../cache';
import { kafka } from '../messaging/kafka';
import jwt from 'jsonwebtoken';
import { config } from '../config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  subscriptions?: Set<string>;
}

export const setupWebSocket = (io: SocketIOServer): void => {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwt.secret) as any;
      socket.userId = decoded.userId;
      socket.subscriptions = new Set();

      logger.info('WebSocket client authenticated', { userId: socket.userId });
      next();
    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('WebSocket client connected', { 
      userId: socket.userId,
      socketId: socket.id 
    });

    // Subscribe to market data
    socket.on('subscribe:market', async (data: { symbol: string }) => {
      const { symbol } = data;
      const channel = `market:${symbol}`;

      socket.join(channel);
      socket.subscriptions?.add(channel);

      logger.info('Client subscribed to market data', { 
        userId: socket.userId,
        symbol 
      });

      // Send initial market data
      const marketData = await cache.get(`market:${symbol}`);
      if (marketData) {
        socket.emit('market:update', { symbol, data: marketData });
      }
    });

    // Subscribe to orderbook
    socket.on('subscribe:orderbook', async (data: { symbol: string }) => {
      const { symbol } = data;
      const channel = `orderbook:${symbol}`;

      socket.join(channel);
      socket.subscriptions?.add(channel);

      logger.info('Client subscribed to orderbook', { 
        userId: socket.userId,
        symbol 
      });

      // Send initial orderbook
      const orderbook = await cache.get(`orderbook:${symbol}`);
      if (orderbook) {
        socket.emit('orderbook:update', { symbol, data: orderbook });
      }
    });

    // Subscribe to trades
    socket.on('subscribe:trades', (data: { symbol: string }) => {
      const { symbol } = data;
      const channel = `trades:${symbol}`;

      socket.join(channel);
      socket.subscriptions?.add(channel);

      logger.info('Client subscribed to trades', { 
        userId: socket.userId,
        symbol 
      });
    });

    // Subscribe to user orders
    socket.on('subscribe:orders', () => {
      const channel = `orders:${socket.userId}`;

      socket.join(channel);
      socket.subscriptions?.add(channel);

      logger.info('Client subscribed to orders', { 
        userId: socket.userId 
      });
    });

    // Subscribe to user positions
    socket.on('subscribe:positions', () => {
      const channel = `positions:${socket.userId}`;

      socket.join(channel);
      socket.subscriptions?.add(channel);

      logger.info('Client subscribed to positions', { 
        userId: socket.userId 
      });
    });

    // Subscribe to user portfolio
    socket.on('subscribe:portfolio', async () => {
      const channel = `portfolio:${socket.userId}`;

      socket.join(channel);
      socket.subscriptions?.add(channel);

      logger.info('Client subscribed to portfolio', { 
        userId: socket.userId 
      });

      // Send initial portfolio data
      const portfolio = await cache.get(`portfolio:${socket.userId}`);
      if (portfolio) {
        socket.emit('portfolio:update', portfolio);
      }
    });

    // Unsubscribe from channel
    socket.on('unsubscribe', (data: { channel: string }) => {
      const { channel } = data;

      socket.leave(channel);
      socket.subscriptions?.delete(channel);

      logger.info('Client unsubscribed', { 
        userId: socket.userId,
        channel 
      });
    });

    // Ping/Pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', { 
        userId: socket.userId,
        socketId: socket.id,
        reason 
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('WebSocket error:', { 
        userId: socket.userId,
        error 
      });
    });
  });

  // Subscribe to Kafka topics and broadcast to WebSocket clients
  setupKafkaToWebSocketBridge(io);

  logger.info('WebSocket server initialized');
};

const setupKafkaToWebSocketBridge = (io: SocketIOServer): void => {
  // Market data updates
  kafka.subscribe('market-data', 'websocket-market', async (message) => {
    const { symbol, data } = message;
    io.to(`market:${symbol}`).emit('market:update', { symbol, data });
    
    // Cache latest data
    await cache.set(`market:${symbol}`, data, 60);
  });

  // Orderbook updates
  kafka.subscribe('orderbook-updates', 'websocket-orderbook', async (message) => {
    const { symbol, data } = message;
    io.to(`orderbook:${symbol}`).emit('orderbook:update', { symbol, data });
    
    // Cache latest orderbook
    await cache.set(`orderbook:${symbol}`, data, 5);
  });

  // Trade updates
  kafka.subscribe('trades', 'websocket-trades', async (message) => {
    const { symbol, trade } = message;
    io.to(`trades:${symbol}`).emit('trade:new', { symbol, trade });
  });

  // Order updates
  kafka.subscribe('orders', 'websocket-orders', async (message) => {
    const { userId, type, order } = message;
    
    io.to(`orders:${userId}`).emit('order:update', {
      type,
      order,
    });
  });

  // Position updates
  kafka.subscribe('positions', 'websocket-positions', async (message) => {
    const { userId, position } = message;
    
    io.to(`positions:${userId}`).emit('position:update', position);
  });

  // Portfolio updates
  kafka.subscribe('portfolio', 'websocket-portfolio', async (message) => {
    const { userId, portfolio } = message;
    
    io.to(`portfolio:${userId}`).emit('portfolio:update', portfolio);
    
    // Cache portfolio
    await cache.set(`portfolio:${userId}`, portfolio, 60);
  });

  logger.info('Kafka to WebSocket bridge initialized');
};

export default setupWebSocket;
