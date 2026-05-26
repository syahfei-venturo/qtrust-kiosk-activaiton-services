import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/redis/redis.service';

describe('KioskGateway (e2e)', () => {
  let app: INestApplication;
  let clientSocket: Socket;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Flush stale channel cache so getChannelData returns freshly serialized data
    const redis = app.get(RedisService);
    const client = redis.getClient();
    const keys = await client.keys('channel:*');
    if (keys.length > 0) {
      await client.del(...keys);
    }

    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = address.port;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'cbm_kiosk@qtrust.id', password: 'kiosk123' });
    token = loginRes.body.token;

    clientSocket = io(`http://localhost:${port}/kiosk`, {
      auth: { token },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      clientSocket.on('connect', resolve);
    });
  });

  afterAll(async () => {
    clientSocket?.disconnect();
    await app.close();
  });

  it('should connect with valid JWT', () => {
    expect(clientSocket.connected).toBe(true);
  });

  it('should reject connection without token', (done) => {
    const address = app.getHttpServer().address();
    const badSocket = io(`http://localhost:${address.port}/kiosk`, {
      auth: {},
      transports: ['websocket'],
      reconnection: false,
    });

    let errorReceived = false;
    badSocket.on('connect_error', (err) => {
      expect(err.message).toBeDefined();
      errorReceived = true;
      badSocket.disconnect();
      done();
    });

    setTimeout(() => {
      if (!errorReceived) {
        badSocket.disconnect();
        expect(badSocket.connected).toBe(false);
        done();
      }
    }, 3000);
  }, 10000);

  it('should subscribe to activation channel and get initial data', (done) => {
    clientSocket.emit('subscribe', { channel: 'activation.KIOSK-001' }, (response: any) => {
      expect(response).toHaveProperty('data');
      expect(response.data).toHaveProperty('hardware_id', 'KIOSK-001');
      done();
    });
  });

  it('should subscribe to take_picture channel and get initial data', (done) => {
    clientSocket.emit('subscribe', { channel: 'take_picture.KIOSK-001' }, (response: any) => {
      expect(response).toHaveProperty('data');
      expect(response.data).toHaveProperty('status');
      done();
    });
  });

  it('should unsubscribe from channel', (done) => {
    clientSocket.emit('unsubscribe', { channel: 'activation.KIOSK-001' }, (response: any) => {
      expect(response).toEqual({ ok: true });
      done();
    });
  });
});
