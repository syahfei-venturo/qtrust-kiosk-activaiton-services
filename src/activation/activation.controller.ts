import { Body, Controller, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivationService } from './activation.service';
import { UpdateActivationDto } from './dto/update-activation.dto';

@Controller('v1/activation')
@UseGuards(JwtAuthGuard)
export class ActivationController {
  constructor(private readonly activationService: ActivationService) {}

  @Put(':hardwareId')
  updateActivation(
    @Param('hardwareId') hardwareId: string,
    @Body() dto: UpdateActivationDto,
  ) {
    return this.activationService.updateActivation(hardwareId, dto);
  }
}
