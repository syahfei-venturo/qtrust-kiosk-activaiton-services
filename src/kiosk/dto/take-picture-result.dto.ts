import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class TakePictureResultDto {
  @IsInt()
  @Min(2)
  @Max(3)
  status: number;

  @IsString()
  @IsOptional()
  message?: string;
}
