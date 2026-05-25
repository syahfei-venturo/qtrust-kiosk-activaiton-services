import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { SocketWithUser } from '../interfaces/socket-with-user.interface';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: WsException | Error, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<SocketWithUser>();
    const error = exception instanceof WsException
      ? exception.getError()
      : { code: 'INTERNAL_ERROR', message: exception.message };

    client.emit('error', error);
  }
}
