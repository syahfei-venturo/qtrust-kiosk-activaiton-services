import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  // PrismaModule and RedisModule are @Global — no need to import explicitly
  controllers: [HealthController],
})
export class HealthModule {}
