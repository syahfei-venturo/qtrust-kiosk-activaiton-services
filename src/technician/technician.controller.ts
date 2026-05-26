import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TechnicianService } from './technician.service';
import { TakePictureDto } from './dto/take-picture.dto';
import { ValidateHardwareIdPipe } from '../common/pipes/hardware-id.pipe';

@Controller('v1/technician')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('technician', 'admin')
export class TechnicianController {
  constructor(private readonly technicianService: TechnicianService) {}

  @Post('take-picture/:hardwareId')
  triggerTakePicture(
    @Param('hardwareId', ValidateHardwareIdPipe) hardwareId: string,
    @Body() dto: TakePictureDto,
  ) {
    return this.technicianService.triggerTakePicture(hardwareId, dto);
  }

  @Get('take-picture-status/:hardwareId')
  getTakePictureStatus(
    @Param('hardwareId', ValidateHardwareIdPipe) hardwareId: string,
  ) {
    return this.technicianService.getTakePictureStatus(hardwareId);
  }
}
