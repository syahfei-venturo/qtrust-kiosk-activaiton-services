import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UpdateActivationDto } from './dto/update-activation.dto';
import {
  ActivationResponse,
  serializeActivation,
} from '../common/serializers/activation.serializer';

@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async updateActivation(
    hardwareId: string,
    dto: UpdateActivationDto,
  ): Promise<{ data: ActivationResponse; broadcast: boolean }> {
    const existing = await this.prisma.hardwareActivation.findUnique({
      where: { hardwareId },
    });

    if (!existing) {
      throw new NotFoundException(`Hardware ${hardwareId} not found`);
    }

    const updated = await this.prisma.hardwareActivation.update({
      where: { hardwareId },
      data: {
        activationId: dto.activation_id,
        status: dto.status,
        deviceName: dto.device_name,
        groupName: dto.group_name,
        groupId: dto.group_id,
        dealerName: dto.dealer_name,
        qrcode: dto.qrcode,
        serialNumber: dto.serial_number,
        loginDate: dto.login_date ? new Date(dto.login_date) : undefined,
        defaultContentType: dto.default_content_type,
        defaultContentUrl: dto.default_content_url,
        linkUrl: dto.link_url,
        location: dto.location,
        region: dto.region,
        kdDealer: dto.kd_dealer,
        lat: dto.lat,
        lng: dto.lng,
        specification: dto.specification
          ? (dto.specification as Prisma.InputJsonValue)
          : undefined,
      },
    });

    const channel = `activation.${hardwareId}`;
    const serialized = serializeActivation(updated);

    let broadcast = true;
    try {
      await Promise.all([
        this.redis.setChannelState(channel, serialized),
        this.redis.publish(channel, serialized),
      ]);
    } catch (error) {
      broadcast = false;
      this.logger.error(`Redis broadcast failed for ${channel} — clients may have stale data`, error);
    }

    return { data: serialized, broadcast };
  }
}
