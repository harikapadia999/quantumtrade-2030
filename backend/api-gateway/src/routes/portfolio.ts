import { Router } from 'express';
import { PortfolioController } from '../controllers/PortfolioController';
import { authenticate } from '../middleware/auth';
import { validateQuery } from '../middleware/validation';
import Joi from 'joi';

const router = Router();
const portfolioController = new PortfolioController();

// All portfolio routes require authentication
router.use(authenticate);

const getHistoryQuerySchema = Joi.object({
  period: Joi.string().valid('1d', '7d', '30d', '90d', '1y', 'all').default('30d'),
  interval: Joi.string().valid('1h', '1d', '1w').default('1d'),
});

/**
 * @route   GET /api/portfolio
 * @desc    Get user's portfolio
 * @access  Private
 */
router.get('/', portfolioController.getPortfolio);

/**
 * @route   GET /api/portfolio/positions
 * @desc    Get user's positions
 * @access  Private
 */
router.get('/positions', portfolioController.getPositions);

/**
 * @route   GET /api/portfolio/history
 * @desc    Get portfolio value history
 * @access  Private
 */
router.get(
  '/history',
  validateQuery(getHistoryQuerySchema),
  portfolioController.getHistory
);

/**
 * @route   GET /api/portfolio/performance
 * @desc    Get portfolio performance metrics
 * @access  Private
 */
router.get('/performance', portfolioController.getPerformance);

/**
 * @route   GET /api/portfolio/allocation
 * @desc    Get portfolio allocation breakdown
 * @access  Private
 */
router.get('/allocation', portfolioController.getAllocation);

/**
 * @route   GET /api/portfolio/pnl
 * @desc    Get P&L breakdown
 * @access  Private
 */
router.get('/pnl', portfolioController.getPnL);

/**
 * @route   GET /api/portfolio/risk-metrics
 * @desc    Get portfolio risk metrics
 * @access  Private
 */
router.get('/risk-metrics', portfolioController.getRiskMetrics);

/**
 * @route   POST /api/portfolio/deposit
 * @desc    Deposit funds
 * @access  Private
 */
router.post('/deposit', portfolioController.deposit);

/**
 * @route   POST /api/portfolio/withdraw
 * @desc    Withdraw funds
 * @access  Private
 */
router.post('/withdraw', portfolioController.withdraw);

export { router as portfolioRouter };
