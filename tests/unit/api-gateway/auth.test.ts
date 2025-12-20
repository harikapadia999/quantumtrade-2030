import request from 'supertest';
import { app } from '../../../backend/api-gateway/src/index';
import { db } from '../../../backend/api-gateway/src/database';
import { cache } from '../../../backend/api-gateway/src/cache';

describe('Authentication API', () => {
  beforeAll(async () => {
    // Setup test database
    await db.query('DELETE FROM users WHERE email LIKE \'%test.com\'');
  });

  afterAll(async () => {
    // Cleanup
    await db.close();
    await cache.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      const userData = {
        email: 'duplicate@test.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      };

      // First registration
      await request(app).post('/api/auth/register').send(userData);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already registered');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(response.status).toBe(400);
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com',
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    const testUser = {
      email: 'logintest@test.com',
      password: 'SecurePass123!',
      firstName: 'Login',
      lastName: 'Test',
    };

    beforeAll(async () => {
      // Create test user
      await request(app).post('/api/auth/register').send(testUser);
      
      // Verify email
      const user = await db.query(
        'SELECT verification_token FROM users WHERE email = $1',
        [testUser.email]
      );
      
      await db.query(
        'UPDATE users SET email_verified = true WHERE email = $1',
        [testUser.email]
      );
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(401);
    });

    it('should reject unverified email', async () => {
      // Create unverified user
      await request(app).post('/api/auth/register').send({
        email: 'unverified@test.com',
        password: 'SecurePass123!',
        firstName: 'Unverified',
        lastName: 'User',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unverified@test.com',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('verify your email');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user and invalidate token', async () => {
      // Login first
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@test.com',
          password: 'SecurePass123!',
        });

      const token = loginRes.body.accessToken;

      // Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);

      // Try to use token after logout
      const protectedRes = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(protectedRes.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@test.com',
          password: 'SecurePass123!',
        });

      const refreshToken = loginRes.body.refreshToken;

      // Refresh
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.accessToken).not.toBe(loginRes.body.accessToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@test.com',
          password: 'SecurePass123!',
        });

      const token = loginRes.body.accessToken;

      // Get current user
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('logintest@test.com');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });
});
