import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Full Flow (e2e)', () => {
  let app: INestApplication;
  let kioskSocket: Socket;
  let kioskToken: string;
  let techToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = address.port;

    // Login both users
    const kioskLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'cbm_kiosk@qtrust.id', password: 'kiosk123' });
    kioskToken = kioskLogin.body.access_token;

    const techLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'technician@qtrust.id', password: 'tech123' });
    techToken = techLogin.body.access_token;

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

        kioskSocket.on('event', (payload) => {
          if (payload.channel === 'take_picture.KIOSK-002' && !eventReceived) {
            eventReceived = true;
            expect(payload.data.status).toBe(1);
            expect(payload).toHaveProperty('timestamp');
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

        kioskSocket.on('event', (payload) => {
          if (payload.channel === 'activation.KIOSK-003' && !eventReceived) {
            eventReceived = true;
            expect(payload.data.status).toBe('Activated');
            expect(payload.data.deviceName).toBe('Updated Kiosk');
            kioskSocket.off('event');
            done();
          }
        });

        // Small delay to ensure subscription is processed
        setTimeout(() => {
          request(app.getHttpServer())
            .put('/v1/activation/KIOSK-003')
            .set('Authorization', `Bearer ${techToken}`)
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

    expect(response.body.data.hardware_id).toBe('KIOSK-001');
    expect(response.body.data).toHaveProperty('status');
  });
});
