import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class TakePictureDto {
  @IsInt()
  @Min(0)
  @Max(3)
  status: number;

  @IsString()
  @IsOptional()
  message?: string;
}
