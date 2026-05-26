import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

const logger = new Logger('Bootstrap');

const INSECURE_JWT_SECRETS = new Set([
  'dev-secret-change-in-production',
  'secret',
  'jwt-secret',
  'changeme',
]);

/** Validate critical env vars. Throws in production if misconfigured. */
function validateEnvironment(configService: ConfigService): void {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const jwtSecret = configService.get<string>('JWT_SECRET', '');

  if (nodeEnv === 'production') {
    if (!jwtSecret || INSECURE_JWT_SECRETS.has(jwtSecret)) {
      throw new Error(
        'FATAL: JWT_SECRET is missing or insecure. Set a strong, unique secret for production.',
      );
    }

    const corsOrigin = configService.get<string>('CORS_ORIGIN', '');
    if (!corsOrigin || corsOrigin === '*') {
      logger.warn('CORS_ORIGIN is wildcard or empty in production — restrict to specific origins');
    }
  }

  if (!jwtSecret) {
    logger.warn('JWT_SECRET not set — using insecure default. Do NOT deploy to production.');
  }
}

class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  async connectToRedis(host: string, port: number, password?: string) {
    const options = {
      host,
      port,
      password: password || undefined,
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
    };

    this.pubClient = new Redis(options);
    this.subClient = new Redis(options);

    // Wait for both clients to be ready
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        this.pubClient!.on('ready', resolve);
        this.pubClient!.on('error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        this.subClient!.on('ready', resolve);
        this.subClient!.on('error', reject);
      }),
    ]);

    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
  }

  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }

  async close(): Promise<void> {
    await Promise.all([
      this.pubClient?.quit(),
      this.subClient?.quit(),
    ]);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  validateEnvironment(configService);

  let redisAdapter: RedisIoAdapter | null = null;
  const redisRequired = configService.get<string>('REDIS_REQUIRED', 'true') === 'true';
  try {
    redisAdapter = new RedisIoAdapter(app);
    await redisAdapter.connectToRedis(
      configService.get<string>('REDIS_HOST', 'localhost'),
      configService.get<number>('REDIS_PORT', 6379),
      configService.get<string>('REDIS_PASSWORD'),
    );
    app.useWebSocketAdapter(redisAdapter);
  } catch (error) {
    if (redisRequired) {
      logger.error('Redis connection failed and REDIS_REQUIRED=true. Aborting startup.', error);
      process.exit(1);
    }
    logger.warn('Redis connection failed, falling back to default adapter (non-production mode)', error);
    redisAdapter = null;
  }

  // Enable graceful shutdown — cleans up Prisma, Redis, and adapter connections
  app.enableShutdownHooks();
  if (redisAdapter) {
    const adapter = redisAdapter;
    process.on('beforeExit', async () => {
      await adapter.close();
    });
  }

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : 'http://localhost:3000',
    credentials: true,
  });

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  logger.log(`Kiosk Socket Service running on port ${port}`);
}

bootstrap();
