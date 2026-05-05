const { v4: uuidv4 } = require('uuid');

class DeviceManager {
  constructor(db) {
    this.db = db;
    this.initDeviceTables();
    this.heartbeatTimers = {};
  }

  initDeviceTables() {
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        device_type TEXT NOT NULL,
        model TEXT,
        mac_address TEXT UNIQUE,
        ip_address TEXT,
        port INTEGER DEFAULT 8080,
        status TEXT DEFAULT 'online',
        firmware_version TEXT,
        serial_number TEXT UNIQUE,
        last_heartbeat TEXT,
        capabilities TEXT,
        metadata TEXT,
        registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      )
    `).run();

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS device_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT,
        timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(device_id) REFERENCES devices(id)
      )
    `).run();
  }

  registerDevice(tenantId, deviceInfo) {
    try {
      const deviceId = deviceInfo.deviceId || uuidv4();
      const capabilities = JSON.stringify(deviceInfo.capabilities || {});
      const metadata = JSON.stringify(deviceInfo.metadata || {});

      this.db.prepare(`
        INSERT OR REPLACE INTO devices (
          id, tenant_id, name, device_type, model, mac_address, ip_address, port,
          firmware_version, serial_number, capabilities, metadata, last_heartbeat
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        deviceId,
        tenantId,
        deviceInfo.name || '未命名设备',
        deviceInfo.deviceType || 'audio-speaker',
        deviceInfo.model || 'unknown',
        deviceInfo.macAddress,
        deviceInfo.ipAddress,
        deviceInfo.port || 8080,
        deviceInfo.firmwareVersion || '1.0.0',
        deviceInfo.serialNumber,
        capabilities,
        metadata,
        new Date().toISOString()
      );

      this.recordEvent(deviceId, 'device_registered', { name: deviceInfo.name });
      return { id: deviceId, status: 'online' };
    } catch (err) {
      throw new Error(`设备注册失败: ${err.message}`);
    }
  }

  getDevice(deviceId) {
    const device = this.db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
    if (device) {
      device.capabilities = JSON.parse(device.capabilities || '{}');
      device.metadata = JSON.parse(device.metadata || '{}');
    }
    return device;
  }

  getDevicesByTenant(tenantId) {
    const devices = this.db.prepare(`
      SELECT * FROM devices WHERE tenant_id = ? ORDER BY registered_at DESC
    `).all(tenantId);
    return devices.map(d => ({
      ...d,
      capabilities: JSON.parse(d.capabilities || '{}'),
      metadata: JSON.parse(d.metadata || '{}')
    }));
  }

  updateDeviceHeartbeat(deviceId) {
    this.db.prepare(`
      UPDATE devices SET last_heartbeat = ?, status = 'online', updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), new Date().toISOString(), deviceId);
  }

  setDeviceStatus(deviceId, status) {
    this.db.prepare(`
      UPDATE devices SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, new Date().toISOString(), deviceId);
  }

  recordEvent(deviceId, eventType, eventData = {}) {
    this.db.prepare(`
      INSERT INTO device_events (device_id, event_type, event_data)
      VALUES (?, ?, ?)
    `).run(deviceId, eventType, JSON.stringify(eventData));
  }

  getDeviceEvents(deviceId, limit = 50) {
    return this.db.prepare(`
      SELECT * FROM device_events WHERE device_id = ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(deviceId, limit);
  }

  removeDevice(deviceId) {
    this.db.prepare('DELETE FROM devices WHERE id = ?').run(deviceId);
    this.recordEvent(deviceId, 'device_removed');
  }

  getOnlineDevices(tenantId) {
    return this.db.prepare(`
      SELECT * FROM devices WHERE tenant_id = ? AND status = 'online'
      ORDER BY last_heartbeat DESC
    `).all(tenantId);
  }

  checkOfflineDevices(tenantId, timeoutMs = 60000) {
    const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();
    return this.db.prepare(`
      SELECT * FROM devices WHERE tenant_id = ? AND status = 'online'
      AND (last_heartbeat IS NULL OR last_heartbeat < ?)
      ORDER BY last_heartbeat ASC
    `).all(tenantId, cutoffTime);
  }
}

module.exports = DeviceManager;
