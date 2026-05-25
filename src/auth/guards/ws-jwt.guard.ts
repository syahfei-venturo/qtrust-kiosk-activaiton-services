import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { SocketWithUser, JwtPayload } from '../../common/interfaces/socket-with-user.interface';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<SocketWithUser>();
    const token = client.handshake?.auth?.token;

    if (!token) {
      throw new WsException({ code: 'AUTH_INVALID', message: 'No token provided' });
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data = { user: payload };
      return true;
    } catch (error) {
      const code = error.name === 'TokenExpiredError' ? 'AUTH_EXPIRED' : 'AUTH_INVALID';
      const message = error.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token';
      throw new WsException({ code, message });
    }
  }
}
