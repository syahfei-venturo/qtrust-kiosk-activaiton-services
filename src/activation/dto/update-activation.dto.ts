import { IsString, IsOptional, IsInt } from 'class-validator';

export class UpdateActivationDto {
  @IsString()
  @IsOptional()
  activation_id?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  device_name?: string;

  @IsString()
  @IsOptional()
  group_name?: string;

  @IsInt()
  @IsOptional()
  group_id?: number;

  @IsString()
  @IsOptional()
  dealer_name?: string;
}
