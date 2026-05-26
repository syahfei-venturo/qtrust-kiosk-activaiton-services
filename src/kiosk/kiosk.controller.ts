import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { KioskService } from './kiosk.service';
import { TakePictureResultDto } from './dto/take-picture-result.dto';
import { ValidateHardwareIdPipe } from '../common/pipes/hardware-id.pipe';

@Controller('v1/kiosk')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('kiosk', 'admin')
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  /**
   * Kiosk reports take_picture capture result back to server.
   * status=2: capture successful
   * status=3: capture failed (message contains error detail)
   *
   * Side effect: broadcasts event to `take_picture.{hardwareId}` channel
   * so technician receives real-time status update.
   */
  @Post('take-picture-result/:hardwareId')
  reportTakePictureResult(
    @Param('hardwareId', ValidateHardwareIdPipe) hardwareId: string,
    @Body() dto: TakePictureResultDto,
  ) {
    return this.kioskService.reportTakePictureResult(hardwareId, dto);
  }
}
