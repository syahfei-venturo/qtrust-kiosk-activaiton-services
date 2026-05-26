import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('should return access_token and refresh_token for valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'cbm_kiosk@qtrust.id', password: 'kiosk123' })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).toHaveProperty('refresh_expires_in');
      expect(response.body).toHaveProperty('expires_in', 86400);
      expect(typeof response.body.token).toBe('string');
      expect(typeof response.body.refresh_token).toBe('string');
    });

    it('should return 401 for invalid password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'cbm_kiosk@qtrust.id', password: 'wrongpass' })
        .expect(401);
    });

    it('should return 401 for non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@qtrust.id', password: 'whatever1' })
        .expect(401);
    });

    it('should return 400 for invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'kiosk123' })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should issue new token pair with valid refresh token', async () => {
      // Login first to get refresh token
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'cbm_kiosk@qtrust.id', password: 'kiosk123' })
        .expect(201);

      const refreshToken = loginRes.body.refresh_token;
      expect(refreshToken).toBeDefined();

      // Use refresh token
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(201);

      expect(refreshRes.body).toHaveProperty('token');
      expect(refreshRes.body).toHaveProperty('refresh_token');
      // New refresh token should differ (rotation)
      expect(refreshRes.body.refresh_token).not.toBe(refreshToken);
    });

    it('should reject reused (already-rotated) refresh token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'technician@qtrust.id', password: 'tech1234' })
        .expect(201);

      const firstRefresh = loginRes.body.refresh_token;

      // First refresh succeeds
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: firstRefresh })
        .expect(201);

      // Second use of same token → revoked
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: firstRefresh })
        .expect(401);
    });

    it('should return 401 for invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'totally-fake-token' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should revoke all refresh tokens for authenticated user', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@qtrust.id', password: 'admin123' })
        .expect(201);

      const { token, refresh_token } = loginRes.body;

      // Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      // Refresh token should now be revoked
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token })
        .expect(401);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(401);
    });
  });
});
