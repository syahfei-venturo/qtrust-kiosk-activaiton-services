import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class KioskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getChannelData(channel: string): Promise<unknown | null> {
    // Try Redis cache first
    const cached = await this.redis.getChannelState(channel);
    if (cached) return cached;

    // Fallback to DB
    const [type, hardwareId] = channel.split('.');
    if (!type || !hardwareId) return null;

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

    return null;
  }
}
