import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TakePictureDto } from './dto/take-picture.dto';
import {
  TakePictureResponse,
  serializeTakePicture,
} from '../common/serializers/take-picture.serializer';

@Injectable()
export class TechnicianService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async triggerTakePicture(
    hardwareId: string,
    dto: TakePictureDto,
  ): Promise<TakePictureResponse> {
    const activation = await this.prisma.hardwareActivation.findUnique({
      where: { hardwareId },
    });

    if (!activation) {
      throw new NotFoundException(`Hardware ${hardwareId} not found`);
    }

    const takePicture = await this.prisma.takePicture.create({
      data: {
        hardwareId,
        status: dto.status,
        message: dto.message,
      },
    });

    const channel = `take_picture.${hardwareId}`;
    await this.redis.setChannelState(channel, takePicture);
    await this.redis.publish(channel, takePicture);

    return serializeTakePicture(takePicture);
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
