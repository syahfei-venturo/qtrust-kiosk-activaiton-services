import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UpdateActivationDto } from './dto/update-activation.dto';

@Injectable()
export class ActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async updateActivation(hardwareId: string, dto: UpdateActivationDto) {
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
      },
    });

    const channel = `activation.${hardwareId}`;
    await this.redis.setChannelState(channel, updated);
    await this.redis.publish(channel, updated);

    return {
      statusCode: 200,
      data: updated,
    };
  }
}
