import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { cache } from '../cache';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  blacklistToken,
  AuthRequest 
} from '../middleware/auth';
import { logger } from '../utils/logger';

export class AuthController {
  /**
   * Register a new user
   */
  public register = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('Email already registered', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const userId = uuidv4();
    const verificationToken = uuidv4();

    await db.transaction(async (client) => {
      // Insert user
      await client.query(
        `INSERT INTO users (id, email, password, first_name, last_name, phone_number, 
         verification_token, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [userId, email, hashedPassword, firstName, lastName, phoneNumber, verificationToken]
      );

      // Create initial portfolio
      await client.query(
        `INSERT INTO portfolios (id, user_id, cash_balance, total_equity, created_at, updated_at)
         VALUES ($1, $2, $3, $3, NOW(), NOW())`,
        [uuidv4(), userId, 0]
      );
    });

    // TODO: Send verification email
    logger.info('User registered', { userId, email });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      userId,
    });
  });

  /**
   * Login user
   */
  public login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Get user
    const result = await db.query(
      'SELECT id, email, password, first_name, last_name, role, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401);
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if email is verified
    if (!user.email_verified) {
      throw new AppError('Please verify your email first', 403);
    }

    // Generate tokens
    const accessToken = generateToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Store session in cache
    await cache.set(`session:${user.id}`, {
      userId: user.id,
      email: user.email,
      role: user.role,
      loginAt: new Date().toISOString(),
    }, 86400); // 24 hours

    // Store refresh token
    await cache.set(`refresh:${user.id}`, refreshToken, 604800); // 7 days

    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info('User logged in', { userId: user.id, email: user.email });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
    });
  });

  /**
   * Logout user
   */
  public logout = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const token = req.headers.authorization?.substring(7);

    // Blacklist token
    if (token) {
      await blacklistToken(token);
    }

    // Delete session
    await cache.del(`session:${userId}`);
    await cache.del(`refresh:${userId}`);

    logger.info('User logged out', { userId });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  });

  /**
   * Refresh access token
   */
  public refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }

    const userId = decoded.userId;

    // Check if refresh token exists in cache
    const storedToken = await cache.get(`refresh:${userId}`);
    if (storedToken !== refreshToken) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Get user
    const result = await db.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];

    // Generate new access token
    const accessToken = generateToken(user.id, user.email, user.role);

    res.json({
      success: true,
      accessToken,
    });
  });

  /**
   * Change password
   */
  public changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    // Get user
    const result = await db.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, userId]
    );

    logger.info('Password changed', { userId });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  });

  /**
   * Request password reset
   */
  public resetPasswordRequest = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    // Get user
    const result = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Don't reveal if email exists
      res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent',
      });
      return;
    }

    const userId = result.rows[0].id;

    // Generate reset token
    const resetToken = uuidv4();

    // Store reset token
    await cache.set(`reset:${resetToken}`, userId, 3600); // 1 hour

    // TODO: Send reset email

    logger.info('Password reset requested', { userId, email });

    res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent',
    });
  });

  /**
   * Reset password with token
   */
  public resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    // Get user ID from token
    const userId = await cache.get(`reset:${token}`);
    if (!userId) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, userId]
    );

    // Delete reset token
    await cache.del(`reset:${token}`);

    logger.info('Password reset completed', { userId });

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  });

  /**
   * Get current user
   */
  public getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const result = await db.query(
      `SELECT id, email, first_name, last_name, phone_number, role, 
       email_verified, created_at, last_login
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  });

  /**
   * Verify email
   */
  public verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    const result = await db.query(
      'SELECT id FROM users WHERE verification_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid verification token', 400);
    }

    const userId = result.rows[0].id;

    await db.query(
      'UPDATE users SET email_verified = true, verification_token = NULL WHERE id = $1',
      [userId]
    );

    logger.info('Email verified', { userId });

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  });

  /**
   * Resend verification email
   */
  public resendVerification = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const result = await db.query(
      'SELECT email, email_verified FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];

    if (user.email_verified) {
      throw new AppError('Email already verified', 400);
    }

    // Generate new verification token
    const verificationToken = uuidv4();

    await db.query(
      'UPDATE users SET verification_token = $1 WHERE id = $2',
      [verificationToken, userId]
    );

    // TODO: Send verification email

    logger.info('Verification email resent', { userId });

    res.json({
      success: true,
      message: 'Verification email sent',
    });
  });
}
