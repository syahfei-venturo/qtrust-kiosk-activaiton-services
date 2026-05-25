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
import { UseFilters, UseGuards } from '@nestjs/common';
import { Server } from 'socket.io';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { WsExceptionFilter } from '../common/filters/ws-exception.filter';
import { SocketWithUser } from '../common/interfaces/socket-with-user.interface';
import { KioskService } from './kiosk.service';
import { RedisService } from '../redis/redis.service';
import { SubscribeDto } from './dto/subscribe.dto';

@WebSocketGateway({
  namespace: '/kiosk',
  cors: { origin: '*' },
})
@UseFilters(new WsExceptionFilter())
@UseGuards(WsJwtGuard)
export class KioskGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly kioskService: KioskService,
    private readonly redisService: RedisService,
  ) {}

  afterInit() {
    // Listen for Redis pub/sub broadcasts
    this.redisService.onSubscribe('*', (channel, message) => {
      const data = JSON.parse(message);
      this.server.to(channel).emit('event', {
        channel,
        data,
        timestamp: new Date().toISOString(),
      });
    });

    console.log('KioskGateway initialized on /kiosk namespace');
  }

  handleConnection(client: SocketWithUser) {
    console.log(`Client connected: ${client.id} (${client.data?.user?.email})`);
  }

  handleDisconnect(client: SocketWithUser) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() dto: SubscribeDto,
  ) {
    const { channel } = dto;
    client.join(channel);
    const data = await this.kioskService.getChannelData(channel);
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
