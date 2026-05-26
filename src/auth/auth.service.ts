import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

export interface LoginResponse {
  user_id: string;
  name: string | null;
  email: string;
  role: string;
  last_login: string | null;
  token_expired: string;
  expires_in: number;
  token: string;
  refresh_token: string;
  refresh_expires_in: number;
}

/** Convert JWT expiry string (e.g. '24h', '7d', '3600s') to seconds. */
export function parseExpiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)(s|m|h|d)?$/);
  if (!match) {
    throw new Error(
      `Invalid JWT_EXPIRES_IN format: "${expiry}". Expected: "24h", "7d", "3600s", "60m", or "3600".`,
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2] ?? 's';

  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? 1);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly expiresInSeconds: number;
  private readonly refreshExpiresInSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.expiresInSeconds = parseExpiryToSeconds(
      this.configService.get<string>('JWT_EXPIRES_IN', '24h'),
    );
    this.refreshExpiresInSeconds = parseExpiryToSeconds(
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN', '7d'),
    );
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
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
    const refreshToken = await this.createRefreshToken(user.id);

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokenExpired = new Date(Date.now() + this.expiresInSeconds * 1000).toISOString();

    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      last_login: user.lastLogin?.toISOString() ?? null,
      token_expired: tokenExpired,
      expires_in: this.expiresInSeconds,
      token: accessToken,
      refresh_token: refreshToken,
      refresh_expires_in: this.refreshExpiresInSeconds,
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<LoginResponse> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refresh_token },
      include: { user: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt) {
      // Token reuse detected — revoke all tokens for this user (security measure)
      this.logger.warn(`Refresh token reuse detected for user ${existing.userId}`);
      await this.revokeAllUserTokens(existing.userId);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Rotate: revoke old token, issue new pair
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const { user } = existing;
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const newRefreshToken = await this.createRefreshToken(user.id);
    const tokenExpired = new Date(Date.now() + this.expiresInSeconds * 1000).toISOString();

    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      last_login: user.lastLogin?.toISOString() ?? null,
      token_expired: tokenExpired,
      expires_in: this.expiresInSeconds,
      token: accessToken,
      refresh_token: newRefreshToken,
      refresh_expires_in: this.refreshExpiresInSeconds,
    };
  }

  /** Revoke all refresh tokens for a user (logout-all or security event). */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Generate a cryptographically random refresh token and persist it. */
  private async createRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + this.refreshExpiresInSeconds * 1000);

    await this.prisma.refreshToken.create({
      data: { token, userId, expiresAt },
    });

    // Cleanup: remove expired tokens for this user (best-effort, non-blocking)
    this.pruneExpiredTokens(userId).catch((err: unknown) => {
      this.logger.warn(`Failed to prune expired tokens: ${err}`);
    });

    return token;
  }

  /** Remove expired/revoked tokens older than 30 days. */
  private async pruneExpiredTokens(userId: string): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        OR: [
          { expiresAt: { lt: thirtyDaysAgo } },
          { revokedAt: { lt: thirtyDaysAgo } },
        ],
      },
    });
  }
}
