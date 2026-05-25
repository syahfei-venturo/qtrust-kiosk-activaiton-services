import { Test, TestingModule } from '@nestjs/testing';
import { KioskService } from './kiosk.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BadRequestException } from '@nestjs/common';
import { HardwareActivation, TakePicture } from '@prisma/client';

const mockActivation: HardwareActivation = {
  id: 'id-001',
  hardwareId: 'KIOSK-001',
  activationId: 'ACT-001',
  status: 'Activated',
  deviceName: 'Kiosk 001',
  groupName: 'Group 1',
  groupId: 1,
  dealerName: 'Dealer 1',
  qrcode: null,
  serialNumber: null,
  loginDate: null,
  defaultContentType: null,
  defaultContentUrl: null,
  linkUrl: null,
  location: null,
  region: null,
  kdDealer: null,
  lat: null,
  lng: null,
  spesification: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTakePicture: TakePicture = {
  id: 'TP-001',
  hardwareId: 'KIOSK-001',
  status: 1,
  message: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('KioskService', () => {
  let service: KioskService;
  let prisma: {
    hardwareActivation: { findUnique: jest.Mock };
    takePicture: { findFirst: jest.Mock };
  };
  let redis: {
    getChannelState: jest.Mock;
    setChannelState: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      hardwareActivation: { findUnique: jest.fn() },
      takePicture: { findFirst: jest.fn() },
    };
    redis = {
      getChannelState: jest.fn(),
      setChannelState: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KioskService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<KioskService>(KioskService);
  });

  describe('getChannelData', () => {
    it('should return cached data from Redis', async () => {
      const cached = { hardwareId: 'KIOSK-001', status: 'Activated' };
      redis.getChannelState.mockResolvedValue(cached);

      const result = await service.getChannelData('activation.KIOSK-001');

      expect(result).toEqual(cached);
      expect(redis.getChannelState).toHaveBeenCalledWith('activation.KIOSK-001');
    });

    it('should fall back to DB when cache miss (activation)', async () => {
      redis.getChannelState.mockResolvedValue(null);
      prisma.hardwareActivation.findUnique.mockResolvedValue(mockActivation);

      const result = await service.getChannelData('activation.KIOSK-001');

      expect(result).toEqual(mockActivation);
      expect(prisma.hardwareActivation.findUnique).toHaveBeenCalledWith({
        where: { hardwareId: 'KIOSK-001' },
      });
      expect(redis.setChannelState).toHaveBeenCalledWith('activation.KIOSK-001', mockActivation);
    });

    it('should fall back to DB when cache miss (take_picture)', async () => {
      redis.getChannelState.mockResolvedValue(null);
      prisma.takePicture.findFirst.mockResolvedValue(mockTakePicture);

      const result = await service.getChannelData('take_picture.KIOSK-001');

      expect(result).toEqual(mockTakePicture);
      expect(prisma.takePicture.findFirst).toHaveBeenCalledWith({
        where: { hardwareId: 'KIOSK-001' },
        orderBy: { createdAt: 'desc' },
      });
      expect(redis.setChannelState).toHaveBeenCalledWith('take_picture.KIOSK-001', mockTakePicture);
    });

    it('should throw BadRequestException on invalid channel format', async () => {
      redis.getChannelState.mockResolvedValue(null);

      await expect(service.getChannelData('invalid-channel-format'))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should throw BadRequestException on unknown channel type', async () => {
      redis.getChannelState.mockResolvedValue(null);

      await expect(service.getChannelData('unknown.KIOSK-001'))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should return null if activation not found in DB', async () => {
      redis.getChannelState.mockResolvedValue(null);
      prisma.hardwareActivation.findUnique.mockResolvedValue(null);

      const result = await service.getChannelData('activation.KIOSK-999');

      expect(result).toBeNull();
      expect(redis.setChannelState).not.toHaveBeenCalled();
    });

    it('should return null if take_picture not found in DB', async () => {
      redis.getChannelState.mockResolvedValue(null);
      prisma.takePicture.findFirst.mockResolvedValue(null);

      const result = await service.getChannelData('take_picture.KIOSK-999');

      expect(result).toBeNull();
      expect(redis.setChannelState).not.toHaveBeenCalled();
    });
  });
});
