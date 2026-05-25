import { Test, TestingModule } from '@nestjs/testing';
import { TechnicianService } from './technician.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotFoundException } from '@nestjs/common';
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
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('TechnicianService', () => {
  let service: TechnicianService;
  let prisma: {
    hardwareActivation: { findUnique: jest.Mock };
    takePicture: { create: jest.Mock; findFirst: jest.Mock };
  };
  let redis: {
    setChannelState: jest.Mock;
    publish: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      hardwareActivation: { findUnique: jest.fn() },
      takePicture: { create: jest.fn(), findFirst: jest.fn() },
    };
    redis = {
      setChannelState: jest.fn(),
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TechnicianService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<TechnicianService>(TechnicianService);
  });

  describe('triggerTakePicture', () => {
    it('should create record and broadcast', async () => {
      prisma.hardwareActivation.findUnique.mockResolvedValue(mockActivation);

      const takePicture: TakePicture = {
        id: 'TP-001',
        hardwareId: 'KIOSK-001',
        status: 1,
        message: 'Take photo now',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };
      prisma.takePicture.create.mockResolvedValue(takePicture);

      const result = await service.triggerTakePicture('KIOSK-001', {
        status: 1,
        message: 'Take photo now',
      });

      expect(result.hardware_id).toBe('KIOSK-001');
      expect(result.status).toBe(1);
      expect(result.message).toBe('Take photo now');
      expect(result.created_at).toBe('2026-01-01T00:00:00.000Z');
      expect(redis.setChannelState).toHaveBeenCalledWith('take_picture.KIOSK-001', takePicture);
      expect(redis.publish).toHaveBeenCalledWith('take_picture.KIOSK-001', takePicture);
    });

    it('should throw 404 for unknown hardware', async () => {
      prisma.hardwareActivation.findUnique.mockResolvedValue(null);

      await expect(service.triggerTakePicture('UNKNOWN-999', { status: 1 }))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('getTakePictureStatus', () => {
    it('should return latest record in snake_case', async () => {
      const takePicture: TakePicture = {
        id: 'TP-001',
        hardwareId: 'KIOSK-001',
        status: 1,
        message: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };
      prisma.takePicture.findFirst.mockResolvedValue(takePicture);

      const result = await service.getTakePictureStatus('KIOSK-001');

      expect(result.hardware_id).toBe('KIOSK-001');
      expect(result.status).toBe(1);
      expect(result.message).toBeNull();
      expect(result.created_at).toBe('2026-01-01T00:00:00.000Z');
      expect(prisma.takePicture.findFirst).toHaveBeenCalledWith({
        where: { hardwareId: 'KIOSK-001' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw 404 when no records found', async () => {
      prisma.takePicture.findFirst.mockResolvedValue(null);

      await expect(service.getTakePictureStatus('UNKNOWN-999'))
        .rejects
        .toThrow(NotFoundException);
    });
  });
});
