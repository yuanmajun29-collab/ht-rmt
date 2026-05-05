const dgram = require('dgram');
const os = require('os');

/**
 * 设备发现服务 - 支持UDP广播和mDNS发现
 */
class DeviceDiscovery {
  constructor(config = {}) {
    this.port = config.port || 5353;
    this.broadcastAddr = config.broadcastAddr || '255.255.255.255';
    this.interval = config.interval || 30000;
    this.onDeviceDiscovered = config.onDeviceDiscovered || (() => {});
    this.devices = new Map();
  }

  start() {
    this.server = dgram.createSocket('udp4');

    this.server.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        this.handleDiscoveredDevice(data, rinfo);
      } catch (err) {
        console.error('设备发现解析消息失败:', err);
      }
    });

    this.server.on('error', (err) => {
      console.error('设备发现服务错误:', err);
    });

    this.server.bind(this.port, '0.0.0.0', () => {
      console.log(`设备发现服务已启动，监听端口 ${this.port}`);
      this.server.setBroadcast(true);
    });

    this.periodicBroadcast();
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
    }
  }

  periodicBroadcast() {
    this.broadcastTimer = setInterval(() => {
      this.broadcastDiscoveryRequest();
    }, this.interval);
  }

  broadcastDiscoveryRequest() {
    const request = JSON.stringify({
      type: 'discovery_request',
      timestamp: new Date().toISOString(),
      version: '1.0'
    });

    const message = Buffer.from(request);
    const interfaces = os.networkInterfaces();

    for (const name in interfaces) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          this.server.send(message, 0, message.length, this.port, this.broadcastAddr, (err) => {
            if (err) console.error(`广播失败 (${name}):`, err);
          });
        }
      }
    }
  }

  handleDiscoveredDevice(deviceInfo, rinfo) {
    if (!deviceInfo.deviceId || !deviceInfo.deviceType) {
      return;
    }

    const key = deviceInfo.deviceId;
    const existing = this.devices.get(key);

    const device = {
      deviceId: deviceInfo.deviceId,
      name: deviceInfo.name || 'Unknown Device',
      deviceType: deviceInfo.deviceType,
      model: deviceInfo.model,
      ipAddress: rinfo.address || deviceInfo.ipAddress,
      port: deviceInfo.port || 8080,
      macAddress: deviceInfo.macAddress,
      serialNumber: deviceInfo.serialNumber,
      firmwareVersion: deviceInfo.firmwareVersion,
      capabilities: deviceInfo.capabilities || {},
      metadata: deviceInfo.metadata || {},
      lastSeen: new Date().toISOString()
    };

    if (!existing || existing.lastSeen < device.lastSeen) {
      this.devices.set(key, device);
      if (!existing) {
        console.log(`[发现] 新设备: ${device.name} (${device.deviceId}) at ${rinfo.address}`);
        this.onDeviceDiscovered(device);
      }
    }
  }

  getDiscoveredDevices() {
    return Array.from(this.devices.values());
  }

  getDevice(deviceId) {
    return this.devices.get(deviceId);
  }

  removeDevice(deviceId) {
    this.devices.delete(deviceId);
  }

  clearStaleDevices(maxAgeMs = 300000) {
    const cutoff = Date.now() - maxAgeMs;
    const staleDevices = [];

    for (const [id, device] of this.devices.entries()) {
      if (new Date(device.lastSeen).getTime() < cutoff) {
        this.devices.delete(id);
        staleDevices.push(id);
      }
    }

    return staleDevices;
  }
}

module.exports = DeviceDiscovery;
