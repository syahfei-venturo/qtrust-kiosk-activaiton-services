import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly subscriber: Redis;
  private readonly publisher: Redis;

  constructor(private readonly configService: ConfigService) {
    const options = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
    };

    this.client = new Redis(options);
    this.subscriber = new Redis(options);
    this.publisher = new Redis(options);
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

  async setChannelState(channel: string, data: unknown): Promise<void> {
    await this.client.set(`channel:${channel}`, JSON.stringify(data));
  }

  async getChannelState<T>(channel: string): Promise<T | null> {
    const raw = await this.client.get(`channel:${channel}`);
    return raw ? (JSON.parse(raw) as T) : null;
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
