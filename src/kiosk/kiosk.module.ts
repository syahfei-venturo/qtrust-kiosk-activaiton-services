import { Module } from '@nestjs/common';
import { KioskGateway } from './kiosk.gateway';
import { KioskService } from './kiosk.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [KioskGateway, KioskService],
  exports: [KioskGateway],
})
export class KioskModule {}
