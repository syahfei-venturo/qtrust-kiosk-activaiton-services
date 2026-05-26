import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly subscriber: Redis;
  private readonly publisher: Redis;

  constructor(private readonly configService: ConfigService) {
    const options = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      connectTimeout: 10000,
      commandTimeout: 5000,
      maxRetriesPerRequest: 3,
    };

    this.client = new Redis(options);
    this.subscriber = new Redis(options);
    this.publisher = new Redis(options);

    // Attach error handlers to prevent unhandled error crashes
    this.attachErrorHandlers(this.client, 'client');
    this.attachErrorHandlers(this.subscriber, 'subscriber');
    this.attachErrorHandlers(this.publisher, 'publisher');
  }

  private attachErrorHandlers(redis: Redis, label: string): void {
    redis.on('error', (err) => {
      this.logger.error(`Redis ${label} error: ${err.message}`);
    });

    redis.on('close', () => {
      this.logger.warn(`Redis ${label} connection closed`);
    });

    redis.on('reconnecting', () => {
      this.logger.log(`Redis ${label} reconnecting...`);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }

  getPublisher(): Redis {
    return this.publisher;
  }

  /** Default TTL for channel state cache: 1 hour. */
  private static readonly CHANNEL_STATE_TTL = 3600;

  async setChannelState(channel: string, data: unknown): Promise<void> {
    await this.client.set(
      `channel:${channel}`,
      JSON.stringify(data),
      'EX',
      RedisService.CHANNEL_STATE_TTL,
    );
  }

  async getChannelState<T>(channel: string): Promise<T | null> {
    const raw = await this.client.get(`channel:${channel}`);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(`Corrupted cache for channel:${channel}, clearing entry`, error);
      await this.client.del(`channel:${channel}`);
      return null;
    }
  }

  async publish(channel: string, data: unknown): Promise<void> {
    await this.publisher.publish(`broadcast:${channel}`, JSON.stringify(data));
  }

  onSubscribe(pattern: string, handler: (channel: string, message: string) => void): void {
    this.subscriber.psubscribe(`broadcast:${pattern}`);
    this.subscriber.on('pmessage', (_pat, ch, msg) => {
      const actualChannel = ch.replace('broadcast:', '');
      handler(actualChannel, msg);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    await this.subscriber.quit();
    await this.publisher.quit();
  }
}
