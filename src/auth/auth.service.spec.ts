import { Test, TestingModule } from '@nestjs/testing';
import { AuthService, parseExpiryToSeconds } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('parseExpiryToSeconds', () => {
  it('should parse seconds', () => {
    expect(parseExpiryToSeconds('3600s')).toBe(3600);
  });

  it('should parse minutes', () => {
    expect(parseExpiryToSeconds('60m')).toBe(3600);
  });

  it('should parse hours', () => {
    expect(parseExpiryToSeconds('24h')).toBe(86400);
  });

  it('should parse days', () => {
    expect(parseExpiryToSeconds('7d')).toBe(604800);
  });

  it('should default to seconds when no unit', () => {
    expect(parseExpiryToSeconds('3600')).toBe(3600);
  });

  it('should throw on invalid format', () => {
    expect(() => parseExpiryToSeconds('invalid')).toThrow('Invalid JWT_EXPIRES_IN format');
  });

  it('should throw on empty string', () => {
    expect(() => parseExpiryToSeconds('')).toThrow('Invalid JWT_EXPIRES_IN format');
  });
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    refreshToken: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock; deleteMany: jest.Mock };
  };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ token: 'mock-refresh-token' }),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    jwtService = { sign: jest.fn().mockReturnValue('mock-token') };
    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          JWT_EXPIRES_IN: '24h',
          REFRESH_TOKEN_EXPIRES_IN: '7d',
        };
        return values[key] ?? defaultValue;
      }),
    };

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
      expect(result.refresh_token).toBeDefined();
      expect(result.refresh_expires_in).toBe(604800);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'uuid-1',
        email: 'test@test.com',
        role: 'kiosk',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: { lastLogin: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'uuid-1',
          expiresAt: expect.any(Date),
        }),
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
