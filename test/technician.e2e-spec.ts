import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('TechnicianController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await app.listen(0);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'technician@qtrust.id', password: 'tech123' });
    token = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/technician/take-picture/:hardwareId', () => {
    it('should trigger take picture and return data', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/technician/take-picture/KIOSK-001')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 1 })
        .expect(201);

      expect(response.body.statusCode).toBe(200);
      expect(response.body.data.hardware_id).toBe('KIOSK-001');
      expect(response.body.data.status).toBe(1);
    });

    it('should return 404 for unknown hardware', async () => {
      await request(app.getHttpServer())
        .post('/v1/technician/take-picture/UNKNOWN-999')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 1 })
        .expect(404);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/v1/technician/take-picture/KIOSK-001')
        .send({ status: 1 })
        .expect(401);
    });
  });

  describe('GET /v1/technician/take-picture-status/:hardwareId', () => {
    it('should return latest status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/technician/take-picture-status/KIOSK-001')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.statusCode).toBe(200);
      expect(response.body.data.hardware_id).toBe('KIOSK-001');
      expect(response.body.data).toHaveProperty('status');
    });
  });
});
