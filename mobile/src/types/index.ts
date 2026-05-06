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

export type Schedule = {
  id: number;
  tenant_id: string;
  name: string;
  ip_id: number | null;
  device_ids: string;
  repeat_type: 'once' | 'daily' | 'workdays' | 'weekly';
  scheduled_date: string | null;
  scheduled_time: string;
  days_of_week: string;
  duration: number;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
};

export type BroadcastLog = {
  id: number;
  type: 'scheduled' | 'live' | 'interrupt';
  name: string | null;
  ip_id: number | null;
  content: string | null;
  device_ids: string;
  priority: number;
  status: string;
  created_at: string;
};

export type DeviceStackParamList = {
  DeviceList: undefined;
  DeviceDetail: { device: Device };
};
