import { TakePicture } from '@prisma/client';

export interface TakePictureResponse {
  id: string;
  hardware_id: string;
  status: number;
  message: string | null;
  created_at: string;
  updated_at: string;
}

export function serializeTakePicture(record: TakePicture): TakePictureResponse {
  return {
    id: record.id,
    hardware_id: record.hardwareId,
    status: record.status,
    message: record.message,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}
