import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/redis/redis.service';

describe('Full Flow (e2e)', () => {
  let app: INestApplication;
  let kioskSocket: Socket;
  let kioskToken: string;
  let techToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Flush stale channel cache
    const redis = app.get(RedisService);
    const client = redis.getClient();
    const keys = await client.keys('channel:*');
    if (keys.length > 0) {
      await client.del(...keys);
    }

    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = address.port;

    // Login all users
    const kioskLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'cbm_kiosk@qtrust.id', password: 'kiosk123' });
    kioskToken = kioskLogin.body.token;

    const techLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'technician@qtrust.id', password: 'tech1234' });
    techToken = techLogin.body.token;

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@qtrust.id', password: 'admin123' });
    adminToken = adminLogin.body.token;

    // Kiosk connects via Socket.IO
    kioskSocket = io(`http://localhost:${port}/kiosk`, {
      auth: { token: kioskToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => kioskSocket.on('connect', resolve));
  });

  afterAll(async () => {
    kioskSocket?.disconnect();
    await app.close();
  });

  it(
    'Flow 1: Technician triggers take_picture → Kiosk receives event',
    (done) => {
      kioskSocket.emit('subscribe', { channel: 'take_picture.KIOSK-002' }, () => {
        let eventReceived = false;

        kioskSocket.on('event', (channel: string, data: any, timestamp: string) => {
          if (channel === 'take_picture.KIOSK-002' && !eventReceived) {
            eventReceived = true;
            expect(data.status).toBe(1);
            expect(typeof timestamp).toBe('string');
            kioskSocket.off('event');
            done();
          }
        });

        // Small delay to ensure subscription is processed
        setTimeout(() => {
          request(app.getHttpServer())
            .post('/v1/technician/take-picture/KIOSK-002')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ status: 1 })
            .expect(201)
            .end(() => {});
        }, 100);
      });
    },
    15000,
  );

  it(
    'Flow 2: Admin updates activation → Kiosk receives event',
    (done) => {
      kioskSocket.emit('subscribe', { channel: 'activation.KIOSK-003' }, () => {
        let eventReceived = false;

        kioskSocket.on('event', (channel: string, data: any, timestamp: string) => {
          if (channel === 'activation.KIOSK-003' && !eventReceived) {
            eventReceived = true;
            expect(data.status).toBe('Activated');
            expect(data.device_name).toBe('Updated Kiosk');
            kioskSocket.off('event');
            done();
          }
        });

        // Small delay to ensure subscription is processed
        setTimeout(() => {
          request(app.getHttpServer())
            .put('/v1/activation/KIOSK-003')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'Activated', device_name: 'Updated Kiosk' })
            .expect(200)
            .end(() => {});
        }, 100);
      });
    },
    15000,
  );

  it('Flow 3: Technician polls take_picture status after trigger', async () => {
    await request(app.getHttpServer())
      .post('/v1/technician/take-picture/KIOSK-001')
      .set('Authorization', `Bearer ${techToken}`)
      .send({ status: 1 });

    const response = await request(app.getHttpServer())
      .get('/v1/technician/take-picture-status/KIOSK-001')
      .set('Authorization', `Bearer ${techToken}`)
      .expect(200);

    expect(response.body.hardware_id).toBe('KIOSK-001');
    expect(response.body).toHaveProperty('status');
  });
});
