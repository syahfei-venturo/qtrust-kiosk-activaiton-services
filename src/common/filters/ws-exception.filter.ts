import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { SocketWithUser } from '../interfaces/socket-with-user.interface';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: WsException | Error, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<SocketWithUser>();

    if (exception instanceof WsException) {
      client.emit('error', exception.getError());
      return;
    }

    // Log unexpected errors — these would otherwise disappear silently
    this.logger.error(
      `Unexpected WebSocket error for client ${client.id}: ${exception.message}`,
      exception.stack,
    );

    client.emit('error', { code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}
