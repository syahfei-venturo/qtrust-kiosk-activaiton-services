import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import {
  UseFilters,
  UseGuards,
  Logger,
  UsePipes,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { WsExceptionFilter } from '../common/filters/ws-exception.filter';
import { SocketWithUser } from '../common/interfaces/socket-with-user.interface';
import { KioskService } from './kiosk.service';
import { RedisService } from '../redis/redis.service';
import { SubscribeDto } from './dto/subscribe.dto';

/** Per-client sliding window rate limiter for WebSocket events. */
class WsRateLimiter {
  /** Map of clientId → array of timestamps within the window. */
  private readonly hits = new Map<string, number[]>();
  private readonly sweepInterval: ReturnType<typeof setInterval>;

  constructor(
    private readonly maxHits: number,
    private readonly windowMs: number,
  ) {
    // Sweep stale entries every 5 minutes to prevent memory leak from orphaned clients
    this.sweepInterval = setInterval(() => this.sweep(), 5 * 60_000);
  }

  /** Returns true if request is allowed, false if rate-limited. */
  check(clientId: string): boolean {
    const now = Date.now();
    const timestamps = this.hits.get(clientId) ?? [];
    const windowStart = now - this.windowMs;

    // Drop timestamps outside the window
    const recent = timestamps.filter((t) => t > windowStart);
    if (recent.length >= this.maxHits) {
      return false;
    }

    recent.push(now);
    this.hits.set(clientId, recent);
    return true;
  }

  /** Clean up on disconnect to prevent memory leak. */
  remove(clientId: string): void {
    this.hits.delete(clientId);
  }

  /** Remove entries whose newest timestamp is older than the window. */
  private sweep(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [clientId, timestamps] of this.hits) {
      const latest = timestamps[timestamps.length - 1] ?? 0;
      if (latest < windowStart) {
        this.hits.delete(clientId);
      }
    }
  }

  /** Stop periodic sweep — call on gateway destroy. */
  destroy(): void {
    clearInterval(this.sweepInterval);
    this.hits.clear();
  }
}

@WebSocketGateway({
  namespace: '/kiosk',
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : 'http://localhost:3000',
    credentials: true,
  },
  maxHttpBufferSize: 1e6, // 1MB — prevent oversized payloads
})
@UseFilters(new WsExceptionFilter())
@UseGuards(WsJwtGuard)
export class KioskGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(KioskGateway.name);

  /** 20 subscribe/unsubscribe events per 60 seconds per client. */
  private readonly rateLimiter = new WsRateLimiter(20, 60_000);

  constructor(
    private readonly kioskService: KioskService,
    private readonly redisService: RedisService,
  ) {}

  private redisPubSubHealthy = false;

  afterInit() {
    this.initRedisSubscription();
    this.logger.log('KioskGateway initialized on /kiosk namespace');
  }

  private initRedisSubscription(): void {
    try {
      this.redisService.onSubscribe('*', (channel, message) => {
        try {
          const data = JSON.parse(message);
          this.server.to(channel).emit('event', channel, data, new Date().toISOString());
        } catch (parseError) {
          this.logger.error(`Failed to parse pub/sub message on channel ${channel}`, parseError);
        }
      });
      this.redisPubSubHealthy = true;
      this.logger.log('Redis pub/sub subscription active');
    } catch (error) {
      this.redisPubSubHealthy = false;
      this.logger.error('Redis pub/sub subscription failed — real-time events disabled', error);
    }
  }

  /** Expose pub/sub health for monitoring. */
  isRedisPubSubHealthy(): boolean {
    return this.redisPubSubHealthy;
  }

  handleConnection(client: SocketWithUser) {
    this.logger.log(`Client connected: ${client.id} (${client.data?.user?.email})`);
  }

  handleDisconnect(client: SocketWithUser) {
    this.rateLimiter.remove(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  onModuleDestroy() {
    this.rateLimiter.destroy();
  }

  /** Enforce per-client rate limit. Throws WsException if exceeded. */
  private enforceRateLimit(clientId: string): void {
    if (!this.rateLimiter.check(clientId)) {
      throw new WsException({
        code: 'RATE_LIMITED',
        message: 'Too many requests — try again later',
      });
    }
  }

  /**
   * Validates that the connected user's role has access to the requested channel type.
   * - kiosk: activation channels only
   * - technician: take_picture channels only
   * - admin: all channels
   */
  private validateChannelAccess(role: string, channel: string): void {
    const allowedChannels: Record<string, string[]> = {
      kiosk: ['activation', 'take_picture'],
      technician: ['take_picture'],
      admin: ['activation', 'take_picture'],
    };

    const channelType = channel.substring(0, channel.indexOf('.'));
    const allowed = allowedChannels[role];

    if (!allowed || !allowed.includes(channelType)) {
      throw new WsException({
        code: 'FORBIDDEN',
        message: `Role "${role}" cannot access "${channelType}" channels`,
      });
    }
  }

  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() dto: SubscribeDto,
  ) {
    this.enforceRateLimit(client.id);

    const { channel } = dto;
    const { user } = client.data;

    // Role-based channel access control
    this.validateChannelAccess(user.role, channel);

    let data;
    try {
      data = await this.kioskService.getChannelData(channel);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new WsException({ code: 'INVALID_CHANNEL', message: error.message });
      }
      if (error instanceof NotFoundException) {
        throw new WsException({ code: 'HARDWARE_NOT_FOUND', message: error.message });
      }
      throw error;
    }

    // Only join room after verified — prevents channel enumeration via room membership
    client.join(channel);

    this.logger.log(`Client ${client.id} (${user.email}, role=${user.role}) subscribed to ${channel}`);

    return { data: data ?? null };
  }

  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() dto: SubscribeDto,
  ) {
    this.enforceRateLimit(client.id);

    const { channel } = dto;
    client.leave(channel);
    this.logger.log(`Client ${client.id} unsubscribed from ${channel}`);
    return { ok: true };
  }
}
