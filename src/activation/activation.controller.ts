import { Body, Controller, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActivationService } from './activation.service';
import { UpdateActivationDto } from './dto/update-activation.dto';
import { ValidateHardwareIdPipe } from '../common/pipes/hardware-id.pipe';

@Controller('v1/activation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ActivationController {
  constructor(private readonly activationService: ActivationService) {}

  @Put(':hardwareId')
  updateActivation(
    @Param('hardwareId', ValidateHardwareIdPipe) hardwareId: string,
    @Body() dto: UpdateActivationDto,
  ) {
    return this.activationService.updateActivation(hardwareId, dto);
  }
}
