import { IsString, IsOptional, IsInt, IsNumber, IsDateString, IsObject, ValidateIf, IsIn } from 'class-validator';
import { AtLeastOneField } from '../../common/validators/at-least-one-field.validator';

export class UpdateActivationDto {
  /** Dummy property for class-level validation — ensures non-empty update. */
  @ValidateIf(() => true)
  @AtLeastOneField()
  private readonly _validate?: never;

  @IsString()
  @IsOptional()
  activation_id?: string;

  @IsIn(['Pending', 'Activated', 'Deactivated'])
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

  @IsDateString()
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
  @IsObject()
  specification?: Record<string, unknown>;
}
