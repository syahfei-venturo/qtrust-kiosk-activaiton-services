import { Test, TestingModule } from '@nestjs/testing';
import { ActivationService } from './activation.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotFoundException } from '@nestjs/common';
import { HardwareActivation } from '@prisma/client';

const mockActivation: HardwareActivation = {
  id: 'id-001',
  hardwareId: 'KIOSK-001',
  activationId: 'ACT-001',
  status: 'Pending',
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
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

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
    it('should update record and broadcast snake_case data', async () => {
      const updated: HardwareActivation = {
        ...mockActivation,
        status: 'Activated',
        deviceName: 'Updated Kiosk',
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      };

      prisma.hardwareActivation.findUnique.mockResolvedValue(mockActivation);
      prisma.hardwareActivation.update.mockResolvedValue(updated);

      const result = await service.updateActivation('KIOSK-001', {
        status: 'Activated',
        device_name: 'Updated Kiosk',
      });

      // Response uses snake_case (no statusCode wrapper — interceptor adds envelope)
      expect(result.data.hardware_id).toBe('KIOSK-001');
      expect(result.data.status).toBe('Activated');
      expect(result.data.device_name).toBe('Updated Kiosk');
      expect(result.data.activation_id).toBe('ACT-001');
      expect(result.data.created_at).toBe('2026-01-01T00:00:00.000Z');
      expect(result.data.updated_at).toBe('2026-01-02T00:00:00.000Z');
      expect(result.broadcast).toBe(true);

      // Redis receives serialized snake_case data
      expect(redis.setChannelState).toHaveBeenCalledWith(
        'activation.KIOSK-001',
        expect.objectContaining({ hardware_id: 'KIOSK-001' }),
      );
      expect(redis.publish).toHaveBeenCalledWith(
        'activation.KIOSK-001',
        expect.objectContaining({ hardware_id: 'KIOSK-001' }),
      );
    });

    it('should throw 404 for unknown hardware', async () => {
      prisma.hardwareActivation.findUnique.mockResolvedValue(null);

      await expect(service.updateActivation('UNKNOWN-999', { status: 'Activated' }))
        .rejects
        .toThrow(NotFoundException);
    });
  });
});
