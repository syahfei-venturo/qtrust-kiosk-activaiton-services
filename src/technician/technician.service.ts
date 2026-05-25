import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TakePictureDto } from './dto/take-picture.dto';

@Injectable()
export class TechnicianService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async triggerTakePicture(hardwareId: string, dto: TakePictureDto) {
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
      },
    });

    const channel = `take_picture.${hardwareId}`;
    await this.redis.setChannelState(channel, takePicture);
    await this.redis.publish(channel, takePicture);

    return {
      statusCode: 200,
      message: 'OK',
      data: {
        hardware_id: takePicture.hardwareId,
        status: takePicture.status,
        created_at: takePicture.createdAt.toISOString(),
      },
    };
  }

  async getTakePictureStatus(hardwareId: string) {
    const takePicture = await this.prisma.takePicture.findFirst({
      where: { hardwareId },
      orderBy: { createdAt: 'desc' },
    });

    if (!takePicture) {
      throw new NotFoundException(`No take_picture record for ${hardwareId}`);
    }

    return {
      statusCode: 200,
      data: {
        hardware_id: takePicture.hardwareId,
        status: takePicture.status,
        updated_at: takePicture.updatedAt.toISOString(),
      },
    };
  }
}
