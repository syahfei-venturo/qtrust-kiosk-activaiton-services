import { IsString, Matches } from 'class-validator';

export class SubscribeDto {
  @IsString()
  @Matches(/^(activation|take_picture)\..+$/, {
    message: 'Channel must match pattern: activation.{id} or take_picture.{id}',
  })
  channel: string;
}
