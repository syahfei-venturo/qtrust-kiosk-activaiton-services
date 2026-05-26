import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TakePictureResultDto } from './dto/take-picture-result.dto';
import {
  TakePictureResponse,
  serializeTakePicture,
} from '../common/serializers/take-picture.serializer';
import {
  ActivationResponse,
  serializeActivation,
} from '../common/serializers/activation.serializer';

/** Parses "type.hardwareId" channel format. */
export function parseChannel(channel: string): { type: string; hardwareId: string } {
  const dotIndex = channel.indexOf('.');
  if (dotIndex === -1) {
    throw new BadRequestException(`Invalid channel format: ${channel}`);
  }

  const type = channel.substring(0, dotIndex);
  const hardwareId = channel.substring(dotIndex + 1);

  if (!type || !hardwareId) {
    throw new BadRequestException(`Invalid channel format: ${channel}`);
  }

  return { type, hardwareId };
}

@Injectable()
export class KioskService {
  private readonly logger = new Logger(KioskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Verifies hardware exists in DB. Throws NotFoundException if not. */
  async verifyHardwareExists(hardwareId: string): Promise<void> {
    const exists = await this.prisma.hardwareActivation.findUnique({
      where: { hardwareId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Hardware ${hardwareId} not found`);
    }
  }

  async getChannelData(channel: string): Promise<ActivationResponse | TakePictureResponse | null> {
    // Try Redis cache first — always stores serialized (snake_case) data
    const cached = await this.redis.getChannelState<ActivationResponse | TakePictureResponse>(channel);
    if (cached) return cached;

    const { type, hardwareId } = parseChannel(channel);

    if (type === 'activation') {
      // Upsert: auto-register hardware on first subscribe (kiosk self-registration)
      const activation = await this.prisma.hardwareActivation.upsert({
        where: { hardwareId },
        update: {}, // no-op if already exists
        create: { hardwareId, status: 'Pending' },
      });
      this.logger.log(`Hardware ${hardwareId} subscribe — status: ${activation.status}`);
      const serialized = serializeActivation(activation);
      await this.redis.setChannelState(channel, serialized);
      return serialized;
    }

    if (type === 'take_picture') {
      // Verify hardware exists before querying take_picture
      await this.verifyHardwareExists(hardwareId);

      const takePicture = await this.prisma.takePicture.findFirst({
        where: { hardwareId },
        orderBy: { createdAt: 'desc' },
      });
      if (takePicture) {
        const serialized = serializeTakePicture(takePicture);
        await this.redis.setChannelState(channel, serialized);
        return serialized;
      }
      return null;
    }

    throw new BadRequestException(`Unknown channel type: ${type}`);
  }

  /**
   * Kiosk reports take_picture capture result (status=2 success, status=3 error).
   * Creates new TakePicture record and broadcasts to channel so technician receives update.
   */
  async reportTakePictureResult(
    hardwareId: string,
    dto: TakePictureResultDto,
  ): Promise<{ data: TakePictureResponse; broadcast: boolean }> {
    await this.verifyHardwareExists(hardwareId);

    const takePicture = await this.prisma.takePicture.create({
      data: {
        hardwareId,
        status: dto.status,
        message: dto.message,
      },
    });

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
      this.logger.error(`Redis broadcast failed for ${channel}`, error);
    }

    return { data: serialized, broadcast };
  }
}
