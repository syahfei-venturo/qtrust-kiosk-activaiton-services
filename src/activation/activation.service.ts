import { Injectable, NotFoundException } from '@nestjs/common';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async updateActivation(
    hardwareId: string,
    dto: UpdateActivationDto,
  ): Promise<ActivationResponse> {
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
        loginDate: dto.login_date,
        defaultContentType: dto.default_content_type,
        defaultContentUrl: dto.default_content_url,
        linkUrl: dto.link_url,
        location: dto.location,
        region: dto.region,
        kdDealer: dto.kd_dealer,
        lat: dto.lat,
        lng: dto.lng,
        spesification: dto.spesification as Prisma.InputJsonValue ?? undefined,
      },
    });

    const channel = `activation.${hardwareId}`;
    const serialized = serializeActivation(updated);
    await this.redis.setChannelState(channel, serialized);
    await this.redis.publish(channel, serialized);

    return serialized;
  }
}
