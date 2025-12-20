import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';
import { authenticate } from '../middleware/auth';

const router = Router();
const webhookController = new WebhookController();

/**
 * @route   POST /api/webhooks/exchange/binance
 * @desc    Binance webhook
 * @access  Public (verified by signature)
 */
router.post('/exchange/binance', webhookController.handleBinanceWebhook);

/**
 * @route   POST /api/webhooks/exchange/coinbase
 * @desc    Coinbase webhook
 * @access  Public (verified by signature)
 */
router.post('/exchange/coinbase', webhookController.handleCoinbaseWebhook);

/**
 * @route   POST /api/webhooks/payment/stripe
 * @desc    Stripe webhook
 * @access  Public (verified by signature)
 */
router.post('/payment/stripe', webhookController.handleStripeWebhook);

/**
 * @route   POST /api/webhooks/blockchain/:chain
 * @desc    Blockchain event webhook
 * @access  Public (verified by signature)
 */
router.post('/blockchain/:chain', webhookController.handleBlockchainWebhook);

/**
 * @route   GET /api/webhooks/user
 * @desc    Get user's webhooks
 * @access  Private
 */
router.get('/user', authenticate, webhookController.getUserWebhooks);

/**
 * @route   POST /api/webhooks/user
 * @desc    Create user webhook
 * @access  Private
 */
router.post('/user', authenticate, webhookController.createUserWebhook);

/**
 * @route   DELETE /api/webhooks/user/:id
 * @desc    Delete user webhook
 * @access  Private
 */
router.delete('/user/:id', authenticate, webhookController.deleteUserWebhook);

export { router as webhookRouter };
