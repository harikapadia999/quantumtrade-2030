import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { db } from '../database';
import { cache } from '../cache';
import { kafka } from '../messaging/kafka';
import { logger } from '../utils/logger';
import axios from 'axios';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

export class TradingController {
  /**
   * Submit a new order
   */
  public submitOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const orderData = req.body;

    // Generate order ID
    const orderId = uuidv4();

    // Create order object
    const order = {
      id: orderId,
      userId,
      ...orderData,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // Validate user has sufficient balance/margin
    const portfolio = await this.getPortfolioFromCache(userId);
    if (!portfolio) {
      throw new AppError('Portfolio not found', 404);
    }

    // Calculate required margin
    const requiredMargin = this.calculateRequiredMargin(order);
    if (portfolio.availableMargin < requiredMargin) {
      throw new AppError('Insufficient margin', 400);
    }

    // Save order to database
    await db.query(
      `INSERT INTO orders (id, user_id, symbol, side, type, quantity, price, stop_price, 
       time_in_force, leverage, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        order.id,
        order.userId,
        order.symbol,
        order.side,
        order.type,
        order.quantity,
        order.price || null,
        order.stopPrice || null,
        order.timeInForce,
        order.leverage,
        order.status,
        order.createdAt,
      ]
    );

    // Send order to trading engine
    try {
      await axios.post(`${config.tradingEngine.url}/orders`, order, {
        timeout: config.tradingEngine.timeout,
      });
    } catch (error) {
      logger.error('Failed to submit order to trading engine:', error);
      
      // Update order status to rejected
      await db.query(
        'UPDATE orders SET status = $1 WHERE id = $2',
        ['rejected', orderId]
      );

      throw new AppError('Failed to submit order', 500);
    }

    // Publish order event to Kafka
    await kafka.publish('orders', {
      type: 'order.created',
      orderId,
      userId,
      order,
    });

    // Cache order
    await cache.set(`order:${orderId}`, order, 3600);

    res.status(201).json({
      success: true,
      orderId,
      order,
    });
  });

  /**
   * Get user's orders
   */
  public getOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { symbol, status, side, limit, offset, startDate, endDate } = req.query;

    let query = 'SELECT * FROM orders WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (symbol) {
      query += ` AND symbol = $${paramIndex}`;
      params.push(symbol);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (side) {
      query += ` AND side = $${paramIndex}`;
      params.push(side);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit || 20, offset || 0);

    const result = await db.query(query, params);

    res.json({
      success: true,
      orders: result.rows,
      total: result.rowCount,
    });
  });

  /**
   * Get specific order by ID
   */
  public getOrderById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { orderId } = req.params;

    // Try cache first
    let order = await cache.get(`order:${orderId}`);

    if (!order) {
      // Fetch from database
      const result = await db.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
        [orderId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Order not found', 404);
      }

      order = result.rows[0];
      
      // Cache for future requests
      await cache.set(`order:${orderId}`, order, 3600);
    }

    res.json({
      success: true,
      order,
    });
  });

  /**
   * Cancel an order
   */
  public cancelOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { orderId } = req.params;

    // Get order
    const result = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = result.rows[0];

    if (!['pending', 'open'].includes(order.status)) {
      throw new AppError('Order cannot be cancelled', 400);
    }

    // Send cancel request to trading engine
    try {
      await axios.delete(`${config.tradingEngine.url}/orders/${orderId}`, {
        timeout: config.tradingEngine.timeout,
      });
    } catch (error) {
      logger.error('Failed to cancel order:', error);
      throw new AppError('Failed to cancel order', 500);
    }

    // Update order status
    await db.query(
      'UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3',
      ['cancelled', new Date().toISOString(), orderId]
    );

    // Invalidate cache
    await cache.del(`order:${orderId}`);

    // Publish event
    await kafka.publish('orders', {
      type: 'order.cancelled',
      orderId,
      userId,
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
    });
  });

  /**
   * Get user's trades
   */
  public getTrades = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { symbol, limit, offset, startDate, endDate } = req.query;

    let query = 'SELECT * FROM trades WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (symbol) {
      query += ` AND symbol = $${paramIndex}`;
      params.push(symbol);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit || 20, offset || 0);

    const result = await db.query(query, params);

    res.json({
      success: true,
      trades: result.rows,
      total: result.rowCount,
    });
  });

  /**
   * Get user's positions
   */
  public getPositions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const result = await db.query(
      'SELECT * FROM positions WHERE user_id = $1 AND quantity != 0 ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      success: true,
      positions: result.rows,
    });
  });

  /**
   * Close a position
   */
  public closePosition = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { symbol } = req.params;
    const { quantity, price } = req.body;

    // Get position
    const result = await db.query(
      'SELECT * FROM positions WHERE user_id = $1 AND symbol = $2',
      [userId, symbol]
    );

    if (result.rows.length === 0) {
      throw new AppError('Position not found', 404);
    }

    const position = result.rows[0];

    // Create closing order
    const closeOrder = {
      symbol,
      side: position.quantity > 0 ? 'sell' : 'buy',
      type: price ? 'limit' : 'market',
      quantity: quantity || Math.abs(position.quantity),
      price,
      reduceOnly: true,
    };

    // Submit order
    req.body = closeOrder;
    await this.submitOrder(req, res);
  });

  /**
   * Get orderbook for a symbol
   */
  public getOrderbook = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { symbol } = req.params;

    // Try cache first
    let orderbook = await cache.get(`orderbook:${symbol}`);

    if (!orderbook) {
      // Fetch from trading engine
      try {
        const response = await axios.get(
          `${config.tradingEngine.url}/orderbook/${symbol}`,
          { timeout: config.tradingEngine.timeout }
        );
        orderbook = response.data;

        // Cache for 1 second
        await cache.set(`orderbook:${symbol}`, orderbook, 1);
      } catch (error) {
        logger.error('Failed to fetch orderbook:', error);
        throw new AppError('Failed to fetch orderbook', 500);
      }
    }

    res.json({
      success: true,
      orderbook,
    });
  });

  /**
   * Submit batch orders
   */
  public submitBatchOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { orders } = req.body;

    const results = [];

    for (const orderData of orders) {
      try {
        req.body = orderData;
        const mockRes = {
          status: (code: number) => ({
            json: (data: any) => {
              results.push({ success: true, ...data });
            },
          }),
        } as any;

        await this.submitOrder(req, mockRes);
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({
      success: true,
      results,
    });
  });

  /**
   * Get execution quality metrics
   */
  public getExecutionQuality = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    // Calculate execution metrics from recent trades
    const result = await db.query(
      `SELECT 
        COUNT(*) as total_trades,
        AVG(execution_time) as avg_execution_time,
        AVG(slippage) as avg_slippage,
        SUM(CASE WHEN slippage < 0.001 THEN 1 ELSE 0 END)::float / COUNT(*) as fill_rate
       FROM trades 
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    );

    res.json({
      success: true,
      metrics: result.rows[0],
    });
  });

  // Helper methods
  private async getPortfolioFromCache(userId: string): Promise<any> {
    let portfolio = await cache.get(`portfolio:${userId}`);
    
    if (!portfolio) {
      const result = await db.query(
        'SELECT * FROM portfolios WHERE user_id = $1',
        [userId]
      );
      
      if (result.rows.length > 0) {
        portfolio = result.rows[0];
        await cache.set(`portfolio:${userId}`, portfolio, 60);
      }
    }

    return portfolio;
  }

  private calculateRequiredMargin(order: any): number {
    const notionalValue = order.quantity * (order.price || 0);
    return notionalValue / (order.leverage || 1);
  }
}
