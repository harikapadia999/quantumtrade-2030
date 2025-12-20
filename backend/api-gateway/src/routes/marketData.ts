import { Router } from 'express';
import { MarketDataController } from '../controllers/MarketDataController';
import { optionalAuth } from '../middleware/auth';
import { validateQuery } from '../middleware/validation';
import Joi from 'joi';

const router = Router();
const marketDataController = new MarketDataController();

// Validation schemas
const getCandlesQuerySchema = Joi.object({
  symbol: Joi.string().required().uppercase(),
  interval: Joi.string().required().valid('1m', '5m', '15m', '1h', '4h', '1d'),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  startTime: Joi.date().iso().optional(),
  endTime: Joi.date().iso().optional(),
});

const getTickerQuerySchema = Joi.object({
  symbols: Joi.string().optional(), // comma-separated
});

/**
 * @route   GET /api/market-data/ticker/:symbol
 * @desc    Get ticker data for a symbol
 * @access  Public
 */
router.get('/ticker/:symbol', optionalAuth, marketDataController.getTicker);

/**
 * @route   GET /api/market-data/tickers
 * @desc    Get ticker data for multiple symbols
 * @access  Public
 */
router.get(
  '/tickers',
  optionalAuth,
  validateQuery(getTickerQuerySchema),
  marketDataController.getTickers
);

/**
 * @route   GET /api/market-data/candles
 * @desc    Get candlestick data
 * @access  Public
 */
router.get(
  '/candles',
  optionalAuth,
  validateQuery(getCandlesQuerySchema),
  marketDataController.getCandles
);

/**
 * @route   GET /api/market-data/orderbook/:symbol
 * @desc    Get orderbook for a symbol
 * @access  Public
 */
router.get('/orderbook/:symbol', optionalAuth, marketDataController.getOrderbook);

/**
 * @route   GET /api/market-data/trades/:symbol
 * @desc    Get recent trades for a symbol
 * @access  Public
 */
router.get('/trades/:symbol', optionalAuth, marketDataController.getRecentTrades);

/**
 * @route   GET /api/market-data/stats/:symbol
 * @desc    Get 24h statistics for a symbol
 * @access  Public
 */
router.get('/stats/:symbol', optionalAuth, marketDataController.get24hStats);

/**
 * @route   GET /api/market-data/markets
 * @desc    Get all available markets
 * @access  Public
 */
router.get('/markets', optionalAuth, marketDataController.getMarkets);

/**
 * @route   GET /api/market-data/trending
 * @desc    Get trending markets
 * @access  Public
 */
router.get('/trending', optionalAuth, marketDataController.getTrending);

export { router as marketDataRouter };
