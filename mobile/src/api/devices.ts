import api from './client';
import type { Device, DeviceEvent } from '../types';

export async function fetchDevices(): Promise<Device[]> {
  const res = await api.get('/api/devices');
  return res.data.devices;
}

export async function fetchDevice(deviceId: string): Promise<Device> {
  const res = await api.get(`/api/devices/${deviceId}`);
  return res.data.device;
}

export async function registerDevice(info: {
  deviceId?: string;
  name: string;
  deviceType: string;
  model?: string;
  ipAddress?: string;
  port?: number;
  macAddress?: string;
  serialNumber?: string;
  firmwareVersion?: string;
}): Promise<{ device: { id: string; status: string } }> {
  const res = await api.post('/api/devices/register', info);
  return res.data;
}

export async function sendHeartbeat(deviceId: string): Promise<void> {
  await api.post(`/api/devices/${deviceId}/heartbeat`);
}

export async function deleteDevice(deviceId: string): Promise<void> {
  await api.delete(`/api/devices/${deviceId}`);
}

export async function fetchPlatformInfo(): Promise<Record<string, unknown>> {
  const res = await api.get('/api/platform/info');
  return res.data.platform;
}
