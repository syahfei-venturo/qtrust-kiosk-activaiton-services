import { Test, TestingModule } from '@nestjs/testing';
import { ActivationService } from './activation.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotFoundException } from '@nestjs/common';
import { HardwareActivation } from '@prisma/client';

describe('ActivationService', () => {
  let service: ActivationService;
  let prisma: {
    hardwareActivation: { findUnique: jest.Mock; update: jest.Mock };
  };
  let redis: {
    setChannelState: jest.Mock;
    publish: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      hardwareActivation: { findUnique: jest.fn(), update: jest.fn() },
    };
    redis = {
      setChannelState: jest.fn(),
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivationService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<ActivationService>(ActivationService);
  });

  describe('updateActivation', () => {
    it('should update record and broadcast', async () => {
      const existing: HardwareActivation = {
        id: 'id-001',
        hardwareId: 'KIOSK-001',
        activationId: 'ACT-001',
        status: 'Pending',
        deviceName: 'Kiosk 001',
        groupName: 'Group 1',
        groupId: 1,
        dealerName: 'Dealer 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updated: HardwareActivation = {
        ...existing,
        status: 'Activated',
        deviceName: 'Updated Kiosk',
        updatedAt: new Date(),
        activationId: 'ACT-001',
      };

      prisma.hardwareActivation.findUnique.mockResolvedValue(existing);
      prisma.hardwareActivation.update.mockResolvedValue(updated);

      const result = await service.updateActivation('KIOSK-001', {
        status: 'Activated',
        device_name: 'Updated Kiosk',
      });

      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe('Activated');
      expect(result.data.deviceName).toBe('Updated Kiosk');
      expect(redis.setChannelState).toHaveBeenCalledWith('activation.KIOSK-001', updated);
      expect(redis.publish).toHaveBeenCalledWith('activation.KIOSK-001', updated);
    });

    it('should throw 404 for unknown hardware', async () => {
      prisma.hardwareActivation.findUnique.mockResolvedValue(null);

      await expect(service.updateActivation('UNKNOWN-999', { status: 'Activated' }))
        .rejects
        .toThrow(NotFoundException);
    });
  });
});
