import { Test, TestingModule } from '@nestjs/testing';
import { KioskService, parseChannel } from './kiosk.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HardwareActivation, TakePicture } from '@prisma/client';
import { serializeActivation } from '../common/serializers/activation.serializer';
import { serializeTakePicture } from '../common/serializers/take-picture.serializer';

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
  specification: null,
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

describe('parseChannel', () => {
  it('should parse activation channel', () => {
    expect(parseChannel('activation.KIOSK-001')).toEqual({
      type: 'activation',
      hardwareId: 'KIOSK-001',
    });
  });

  it('should parse take_picture channel', () => {
    expect(parseChannel('take_picture.KIOSK-001')).toEqual({
      type: 'take_picture',
      hardwareId: 'KIOSK-001',
    });
  });

  it('should handle hardwareId with dots', () => {
    expect(parseChannel('activation.KIOSK.001.v2')).toEqual({
      type: 'activation',
      hardwareId: 'KIOSK.001.v2',
    });
  });

  it('should throw on missing dot separator', () => {
    expect(() => parseChannel('invalid')).toThrow(BadRequestException);
  });

  it('should throw on empty type', () => {
    expect(() => parseChannel('.KIOSK-001')).toThrow(BadRequestException);
  });

  it('should throw on empty hardwareId', () => {
    expect(() => parseChannel('activation.')).toThrow(BadRequestException);
  });
});

describe('KioskService', () => {
  let service: KioskService;
  let prisma: {
    hardwareActivation: { findUnique: jest.Mock };
    takePicture: { findFirst: jest.Mock; create: jest.Mock };
  };
  let redis: {
    getChannelState: jest.Mock;
    setChannelState: jest.Mock;
    publish: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      hardwareActivation: { findUnique: jest.fn() },
      takePicture: { findFirst: jest.fn(), create: jest.fn() },
    };
    redis = {
      getChannelState: jest.fn(),
      setChannelState: jest.fn(),
      publish: jest.fn(),
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

      const expected = serializeActivation(mockActivation);
      expect(result).toEqual(expected);
      expect(redis.setChannelState).toHaveBeenCalledWith('activation.KIOSK-001', expected);
    });

    it('should fall back to DB when cache miss (take_picture)', async () => {
      redis.getChannelState.mockResolvedValue(null);
      prisma.hardwareActivation.findUnique
        .mockResolvedValueOnce({ id: 'id-001' });  // verifyHardwareExists
      prisma.takePicture.findFirst.mockResolvedValue(mockTakePicture);

      const result = await service.getChannelData('take_picture.KIOSK-001');

      const expected = serializeTakePicture(mockTakePicture);
      expect(result).toEqual(expected);
      expect(prisma.takePicture.findFirst).toHaveBeenCalledWith({
        where: { hardwareId: 'KIOSK-001' },
        orderBy: { createdAt: 'desc' },
      });
      expect(redis.setChannelState).toHaveBeenCalledWith('take_picture.KIOSK-001', expected);
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

    it('should throw NotFoundException if hardware not found in DB', async () => {
      redis.getChannelState.mockResolvedValue(null);
      prisma.hardwareActivation.findUnique.mockResolvedValue(null);

      await expect(service.getChannelData('activation.KIOSK-999'))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should throw NotFoundException for take_picture if hardware not found', async () => {
      redis.getChannelState.mockResolvedValue(null);
      prisma.hardwareActivation.findUnique.mockResolvedValue(null);

      await expect(service.getChannelData('take_picture.KIOSK-999'))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('reportTakePictureResult', () => {
    it('should create record with status=2 and broadcast', async () => {
      prisma.hardwareActivation.findUnique.mockResolvedValue({ id: 'id-001' });
      const created = { ...mockTakePicture, status: 2 };
      prisma.takePicture.create.mockResolvedValue(created);
      redis.setChannelState.mockResolvedValue(undefined);
      redis.publish.mockResolvedValue(undefined);

      const result = await service.reportTakePictureResult('KIOSK-001', { status: 2 });

      expect(result.data.status).toBe(2);
      expect(result.data.hardware_id).toBe('KIOSK-001');
      expect(result.broadcast).toBe(true);
      expect(prisma.takePicture.create).toHaveBeenCalledWith({
        data: { hardwareId: 'KIOSK-001', status: 2, message: undefined },
      });
      expect(redis.publish).toHaveBeenCalledWith(
        'take_picture.KIOSK-001',
        expect.objectContaining({ status: 2 }),
      );
    });

    it('should create record with status=3 and error message', async () => {
      prisma.hardwareActivation.findUnique.mockResolvedValue({ id: 'id-001' });
      const created = { ...mockTakePicture, status: 3, message: 'Camera unavailable' };
      prisma.takePicture.create.mockResolvedValue(created);
      redis.setChannelState.mockResolvedValue(undefined);
      redis.publish.mockResolvedValue(undefined);

      const result = await service.reportTakePictureResult('KIOSK-001', {
        status: 3,
        message: 'Camera unavailable',
      });

      expect(result.data.status).toBe(3);
      expect(result.data.message).toBe('Camera unavailable');
    });

    it('should throw NotFoundException if hardware not found', async () => {
      prisma.hardwareActivation.findUnique.mockResolvedValue(null);

      await expect(
        service.reportTakePictureResult('KIOSK-999', { status: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return broadcast=false if Redis fails', async () => {
      prisma.hardwareActivation.findUnique.mockResolvedValue({ id: 'id-001' });
      const created = { ...mockTakePicture, status: 2 };
      prisma.takePicture.create.mockResolvedValue(created);
      redis.setChannelState.mockRejectedValue(new Error('Redis down'));

      const result = await service.reportTakePictureResult('KIOSK-001', { status: 2 });

      expect(result.data.status).toBe(2);
      expect(result.broadcast).toBe(false);
    });
  });
});
