import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

export interface LoginResponse {
  user_id: string;
  name: string | null;
  email: string;
  role: string;
  last_login: string | null;
  token_expired: string;
  expires_in: number;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const expiresIn = 86400;
    const tokenExpired = new Date(Date.now() + expiresIn * 1000).toISOString();

    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      last_login: user.lastLogin?.toISOString() ?? null,
      token_expired: tokenExpired,
      expires_in: expiresIn,
      token: accessToken,
    };
  }
}
