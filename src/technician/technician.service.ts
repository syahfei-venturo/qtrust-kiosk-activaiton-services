import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TakePictureDto } from './dto/take-picture.dto';
import {
  TakePictureResponse,
  serializeTakePicture,
} from '../common/serializers/take-picture.serializer';

@Injectable()
export class TechnicianService {
  private readonly logger = new Logger(TechnicianService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async triggerTakePicture(
    hardwareId: string,
    dto: TakePictureDto,
  ): Promise<{ data: TakePictureResponse; broadcast: boolean }> {
    let takePicture;
    try {
      takePicture = await this.prisma.takePicture.create({
        data: {
          hardwareId,
          status: dto.status,
          message: dto.message,
        },
      });
    } catch (error) {
      // P2003 = FK constraint violation → hardware doesn't exist
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException(`Hardware ${hardwareId} not found`);
      }
      throw error;
    }

    const channel = `take_picture.${hardwareId}`;
    const serialized = serializeTakePicture(takePicture);

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

  async getTakePictureStatus(hardwareId: string): Promise<TakePictureResponse> {
    const takePicture = await this.prisma.takePicture.findFirst({
      where: { hardwareId },
      orderBy: { createdAt: 'desc' },
    });

    if (!takePicture) {
      throw new NotFoundException(`No take_picture record for ${hardwareId}`);
    }

    return serializeTakePicture(takePicture);
  }
}
