import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
    jwtService = { sign: jest.fn().mockReturnValue('mock-token') };
    configService = { get: jest.fn().mockReturnValue('24h') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return full user data with token for valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('kiosk123', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        email: 'test@test.com',
        name: 'Test User',
        password: hashedPassword,
        role: 'kiosk',
        lastLogin: new Date('2026-01-01T00:00:00Z'),
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.login({ email: 'test@test.com', password: 'kiosk123' });

      expect(result.token).toBe('mock-token');
      expect(result.user_id).toBe('uuid-1');
      expect(result.email).toBe('test@test.com');
      expect(result.name).toBe('Test User');
      expect(result.role).toBe('kiosk');
      expect(result.expires_in).toBe(86400);
      expect(result.last_login).toBe('2026-01-01T00:00:00.000Z');
      expect(result.token_expired).toBeDefined();
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'uuid-1',
        email: 'test@test.com',
        role: 'kiosk',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: { lastLogin: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        email: 'test@test.com',
        name: null,
        password: hashedPassword,
        role: 'kiosk',
        lastLogin: null,
      });

      await expect(service.login({ email: 'test@test.com', password: 'wrong' }))
        .rejects
        .toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'nobody@test.com', password: 'any' }))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });
});
