import { HardwareActivation } from '@prisma/client';

export interface ActivationResponse {
  id: string;
  hardware_id: string;
  activation_id: string | null;
  status: string;
  device_name: string | null;
  group_name: string | null;
  group_id: number | null;
  dealer_name: string | null;
  qrcode: string | null;
  serial_number: string | null;
  login_date: string | null;
  default_content_type: string | null;
  default_content_url: string | null;
  link_url: string | null;
  location: string | null;
  region: string | null;
  kd_dealer: string | null;
  lat: number | null;
  lng: number | null;
  /** Legacy spelling kept for mobile app backward compatibility. */
  spesification: unknown;
  created_at: string;
  updated_at: string;
}

export function serializeActivation(activation: HardwareActivation): ActivationResponse {
  return {
    id: activation.id,
    hardware_id: activation.hardwareId,
    activation_id: activation.activationId,
    status: activation.status,
    device_name: activation.deviceName,
    group_name: activation.groupName,
    group_id: activation.groupId,
    dealer_name: activation.dealerName,
    qrcode: activation.qrcode,
    serial_number: activation.serialNumber,
    login_date: activation.loginDate?.toISOString() ?? null,
    default_content_type: activation.defaultContentType,
    default_content_url: activation.defaultContentUrl,
    link_url: activation.linkUrl,
    location: activation.location,
    region: activation.region,
    kd_dealer: activation.kdDealer,
    lat: activation.lat,
    lng: activation.lng,
    spesification: activation.specification,
    created_at: activation.createdAt.toISOString(),
    updated_at: activation.updatedAt.toISOString(),
  };
}
