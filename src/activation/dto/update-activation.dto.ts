import { IsString, IsOptional, IsInt, IsNumber } from 'class-validator';

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

  @IsString()
  @IsOptional()
  qrcode?: string;

  @IsString()
  @IsOptional()
  serial_number?: string;

  @IsString()
  @IsOptional()
  login_date?: string;

  @IsString()
  @IsOptional()
  default_content_type?: string;

  @IsString()
  @IsOptional()
  default_content_url?: string;

  @IsString()
  @IsOptional()
  link_url?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  kd_dealer?: string;

  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;

  @IsOptional()
  spesification?: unknown;
}
