import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 5 login attempts per minute to prevent brute force. */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Exchange a valid refresh token for a new access + refresh token pair. */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  /** Revoke all refresh tokens for the authenticated user. */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: { user: { sub: string } }) {
    await this.authService.revokeAllUserTokens(req.user.sub);
    return { message: 'All sessions revoked' };
  }
}
