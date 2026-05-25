import { Socket } from 'socket.io';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface SocketWithUser extends Socket {
  data: {
    user: JwtPayload;
  };
}
