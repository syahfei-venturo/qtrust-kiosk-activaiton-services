import { Test, TestingModule } from '@nestjs/testing';
import { TechnicianService } from './technician.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotFoundException } from '@nestjs/common';
import { HardwareActivation, TakePicture } from '@prisma/client';

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
      const activation: HardwareActivation = {
        id: 'id-001',
        hardwareId: 'KIOSK-001',
        activationId: 'ACT-001',
        status: 'Activated',
        deviceName: 'Kiosk 001',
        groupName: 'Group 1',
        groupId: 1,
        dealerName: 'Dealer 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.hardwareActivation.findUnique.mockResolvedValue(activation);

      const takePicture: TakePicture = {
        id: 'TP-001',
        hardwareId: 'KIOSK-001',
        status: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.takePicture.create.mockResolvedValue(takePicture);

      const result = await service.triggerTakePicture('KIOSK-001', { status: 1 });

      expect(result.statusCode).toBe(200);
      expect(result.data.hardware_id).toBe('KIOSK-001');
      expect(result.data.status).toBe(1);
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
    it('should return latest record', async () => {
      const takePicture: TakePicture = {
        id: 'TP-001',
        hardwareId: 'KIOSK-001',
        status: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.takePicture.findFirst.mockResolvedValue(takePicture);

      const result = await service.getTakePictureStatus('KIOSK-001');

      expect(result.statusCode).toBe(200);
      expect(result.data.hardware_id).toBe('KIOSK-001');
      expect(result.data.status).toBe(1);
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
