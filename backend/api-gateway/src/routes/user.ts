import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import Joi from 'joi';

const router = Router();
const userController = new UserController();

// All user routes require authentication
router.use(authenticate);

const updateProfileSchema = Joi.object({
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  phoneNumber: Joi.string().optional(),
});

const updatePreferencesSchema = Joi.object({
  theme: Joi.string().valid('light', 'dark').optional(),
  language: Joi.string().optional(),
  timezone: Joi.string().optional(),
  notifications: Joi.object({
    email: Joi.boolean().optional(),
    push: Joi.boolean().optional(),
    sms: Joi.boolean().optional(),
  }).optional(),
});

const enable2FASchema = Joi.object({
  code: Joi.string().length(6).required(),
});

/**
 * @route   GET /api/user/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route   PUT /api/user/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', validate(updateProfileSchema), userController.updateProfile);

/**
 * @route   GET /api/user/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get('/preferences', userController.getPreferences);

/**
 * @route   PUT /api/user/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', validate(updatePreferencesSchema), userController.updatePreferences);

/**
 * @route   GET /api/user/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/notifications', userController.getNotifications);

/**
 * @route   PUT /api/user/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/notifications/:id/read', userController.markNotificationRead);

/**
 * @route   DELETE /api/user/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/notifications/:id', userController.deleteNotification);

/**
 * @route   POST /api/user/2fa/enable
 * @desc    Enable 2FA
 * @access  Private
 */
router.post('/2fa/enable', userController.enable2FA);

/**
 * @route   POST /api/user/2fa/verify
 * @desc    Verify 2FA code
 * @access  Private
 */
router.post('/2fa/verify', validate(enable2FASchema), userController.verify2FA);

/**
 * @route   POST /api/user/2fa/disable
 * @desc    Disable 2FA
 * @access  Private
 */
router.post('/2fa/disable', userController.disable2FA);

/**
 * @route   GET /api/user/sessions
 * @desc    Get active sessions
 * @access  Private
 */
router.get('/sessions', userController.getSessions);

/**
 * @route   DELETE /api/user/sessions/:id
 * @desc    Revoke session
 * @access  Private
 */
router.delete('/sessions/:id', userController.revokeSession);

/**
 * @route   GET /api/user/activity
 * @desc    Get user activity log
 * @access  Private
 */
router.get('/activity', userController.getActivity);

export { router as userRouter };
