import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(host: string, port: number, password?: string) {
    const pubClient = createClient({
      url: `redis://${host}:${port}`,
      password: password || undefined,
    });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  try {
    const redisAdapter = new RedisIoAdapter(app);
    await redisAdapter.connectToRedis(
      configService.get<string>('REDIS_HOST', 'localhost'),
      configService.get<number>('REDIS_PORT', 6379),
      configService.get<string>('REDIS_PASSWORD'),
    );
    app.useWebSocketAdapter(redisAdapter);
  } catch (error) {
    logger.warn('Failed to initialize Redis adapter, falling back to default adapter', error);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: configService.get<string>('SOCKET_CORS_ORIGIN', '*'),
  });

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  logger.log(`Kiosk Socket Service running on port ${port}`);
}

bootstrap();
