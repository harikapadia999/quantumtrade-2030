import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { TradingController } from '../controllers/TradingController';
import { orderSchema, cancelOrderSchema } from '../schemas/trading';

const router = Router();
const tradingController = new TradingController();

// All trading routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/trading/orders
 * @desc    Submit a new order
 * @access  Private
 */
router.post(
  '/orders',
  validate(orderSchema),
  tradingController.submitOrder
);

/**
 * @route   GET /api/trading/orders
 * @desc    Get user's orders
 * @access  Private
 */
router.get(
  '/orders',
  tradingController.getOrders
);

/**
 * @route   GET /api/trading/orders/:orderId
 * @desc    Get specific order details
 * @access  Private
 */
router.get(
  '/orders/:orderId',
  tradingController.getOrderById
);

/**
 * @route   DELETE /api/trading/orders/:orderId
 * @desc    Cancel an order
 * @access  Private
 */
router.delete(
  '/orders/:orderId',
  validate(cancelOrderSchema),
  tradingController.cancelOrder
);

/**
 * @route   GET /api/trading/trades
 * @desc    Get user's trade history
 * @access  Private
 */
router.get(
  '/trades',
  tradingController.getTrades
);

/**
 * @route   GET /api/trading/positions
 * @desc    Get user's open positions
 * @access  Private
 */
router.get(
  '/positions',
  tradingController.getPositions
);

/**
 * @route   POST /api/trading/positions/:symbol/close
 * @desc    Close a position
 * @access  Private
 */
router.post(
  '/positions/:symbol/close',
  tradingController.closePosition
);

/**
 * @route   GET /api/trading/orderbook/:symbol
 * @desc    Get orderbook for a symbol
 * @access  Private
 */
router.get(
  '/orderbook/:symbol',
  tradingController.getOrderbook
);

/**
 * @route   POST /api/trading/orders/batch
 * @desc    Submit multiple orders at once
 * @access  Private
 */
router.post(
  '/orders/batch',
  tradingController.submitBatchOrders
);

/**
 * @route   GET /api/trading/execution-quality
 * @desc    Get execution quality metrics
 * @access  Private
 */
router.get(
  '/execution-quality',
  tradingController.getExecutionQuality
);

export { router as tradingRouter };
