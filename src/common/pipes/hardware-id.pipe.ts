import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/** Validates hardwareId format — alphanumeric, hyphens, underscores only. */
const HARDWARE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

@Injectable()
export class ValidateHardwareIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!HARDWARE_ID_PATTERN.test(value)) {
      throw new BadRequestException(
        'Invalid hardware ID format. Only alphanumeric, hyphens, and underscores are allowed (max 100 chars).',
      );
    }
    return value;
  }
}
