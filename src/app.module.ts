import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { KioskModule } from './kiosk/kiosk.module';
import { TechnicianModule } from './technician/technician.module';
import { ActivationModule } from './activation/activation.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    KioskModule,
    TechnicianModule,
    ActivationModule,
    HealthModule,
  ],
})
export class AppModule {}
