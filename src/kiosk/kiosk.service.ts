import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HardwareActivation, TakePicture } from '@prisma/client';

@Injectable()
export class KioskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getChannelData(channel: string): Promise<HardwareActivation | TakePicture | null> {
    // Try Redis cache first
    const cached = await this.redis.getChannelState<HardwareActivation | TakePicture>(channel);
    if (cached) return cached;

    // Parse channel
    const dotIndex = channel.indexOf('.');
    if (dotIndex === -1) {
      throw new BadRequestException(`Invalid channel format: ${channel}`);
    }

    const type = channel.substring(0, dotIndex);
    const hardwareId = channel.substring(dotIndex + 1);

    if (!type || !hardwareId) {
      throw new BadRequestException(`Invalid channel format: ${channel}`);
    }

    if (type === 'activation') {
      const activation = await this.prisma.hardwareActivation.findUnique({
        where: { hardwareId },
      });
      if (activation) {
        await this.redis.setChannelState(channel, activation);
      }
      return activation;
    }

    if (type === 'take_picture') {
      const takePicture = await this.prisma.takePicture.findFirst({
        where: { hardwareId },
        orderBy: { createdAt: 'desc' },
      });
      if (takePicture) {
        await this.redis.setChannelState(channel, takePicture);
      }
      return takePicture;
    }

    throw new BadRequestException(`Unknown channel type: ${type}`);
  }
}
