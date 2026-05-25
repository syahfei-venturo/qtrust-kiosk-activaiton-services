import { IsInt, Min, Max } from 'class-validator';

export class TakePictureDto {
  @IsInt()
  @Min(0)
  @Max(3)
  status: number;
}
