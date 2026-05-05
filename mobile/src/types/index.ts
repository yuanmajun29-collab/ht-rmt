export type User = {
  id: number;
  username: string;
  role: 'admin' | 'user';
  tenant_id: string;
};

export type IpItem = {
  id: number;
  name: string;
  description: string;
  image: string;
  audio_tone: number;
  isFavorite?: boolean;
};

export type Device = {
  id: string;
  tenant_id: string;
  name: string;
  device_type: string;
  model: string;
  mac_address: string | null;
  ip_address: string | null;
  port: number;
  status: 'online' | 'offline';
  firmware_version: string;
  serial_number: string | null;
  last_heartbeat: string | null;
  capabilities: Record<string, unknown>;
  metadata: Record<string, unknown>;
  registered_at: string;
};

export type DeviceEvent = {
  id: number;
  device_id: string;
  event_type: string;
  event_data: string;
  timestamp: string;
};

export type DeviceStackParamList = {
  DeviceList: undefined;
  DeviceDetail: { device: Device };
};
