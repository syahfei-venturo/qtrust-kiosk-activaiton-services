import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TechnicianService } from './technician.service';
import { TakePictureDto } from './dto/take-picture.dto';

@Controller('v1/technician')
@UseGuards(JwtAuthGuard)
export class TechnicianController {
  constructor(private readonly technicianService: TechnicianService) {}

  @Post('take-picture/:hardwareId')
  triggerTakePicture(
    @Param('hardwareId') hardwareId: string,
    @Body() dto: TakePictureDto,
  ) {
    return this.technicianService.triggerTakePicture(hardwareId, dto);
  }

  @Get('take-picture-status/:hardwareId')
  getTakePictureStatus(@Param('hardwareId') hardwareId: string) {
    return this.technicianService.getTakePictureStatus(hardwareId);
  }
}
