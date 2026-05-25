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
import { UseFilters, UseGuards, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { WsExceptionFilter } from '../common/filters/ws-exception.filter';
import { SocketWithUser } from '../common/interfaces/socket-with-user.interface';
import { KioskService } from './kiosk.service';
import { RedisService } from '../redis/redis.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { serializeActivation } from '../common/serializers/activation.serializer';
import { serializeTakePicture } from '../common/serializers/take-picture.serializer';
import { HardwareActivation, TakePicture } from '@prisma/client';

@WebSocketGateway({
  namespace: '/kiosk',
  cors: { origin: '*' },
})
@UseFilters(new WsExceptionFilter())
@UseGuards(WsJwtGuard)
export class KioskGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(KioskGateway.name);

  constructor(
    private readonly kioskService: KioskService,
    private readonly redisService: RedisService,
  ) {}

  afterInit() {
    try {
      // Listen for Redis pub/sub broadcasts
      this.redisService.onSubscribe('*', (channel, message) => {
        const data = JSON.parse(message);
        this.server.to(channel).emit('event', {
          channel,
          data,
          timestamp: new Date().toISOString(),
        });
      });
      this.logger.log('Redis pub/sub subscription active');
    } catch (error) {
      this.logger.error('Redis pub/sub subscription failed', error);
    }

    this.logger.log('KioskGateway initialized on /kiosk namespace');
  }

  handleConnection(client: SocketWithUser) {
    this.logger.log(`Client connected: ${client.id} (${client.data?.user?.email})`);
  }

  handleDisconnect(client: SocketWithUser) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() dto: SubscribeDto,
  ) {
    const { channel } = dto;
    client.join(channel);
    const raw = await this.kioskService.getChannelData(channel);

    if (!raw) {
      return { data: null };
    }

    // Serialize to snake_case based on channel type
    const data = channel.startsWith('activation.')
      ? serializeActivation(raw as HardwareActivation)
      : serializeTakePicture(raw as TakePicture);

    return { data };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() dto: SubscribeDto,
  ) {
    const { channel } = dto;
    client.leave(channel);
    return { ok: true };
  }
}
