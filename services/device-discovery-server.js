/**
 * 设备发现独立服务 - 用于在后台持续发现IP音柱设备
 */
const DeviceDiscovery = require('./services/device-discovery');
const config = require('./config/config');

class DeviceDiscoveryService {
  constructor() {
    this.discovery = new DeviceDiscovery({
      port: config.get('deviceDiscovery.port'),
      interval: config.get('deviceDiscovery.interval')
    });
  }

  start() {
    console.log('设备发现服务启动中...');
    this.discovery.start();

    this.discovery.onDeviceDiscovered = (device) => {
      console.log(`[${new Date().toISOString()}] 发现设备:`, device);
      this.onDiscoveredDevice(device);
    };

    setInterval(() => {
      const stale = this.discovery.clearStaleDevices(120000);
      if (stale.length > 0) {
        console.log(`清理 ${stale.length} 个离线设备`);
      }
    }, 60000);

    console.log(`设备发现服务已启动，监听端口 ${config.get('deviceDiscovery.port')}`);
  }

  onDiscoveredDevice(device) {
    console.log(`[设备发现] ${device.name} (${device.deviceType}) 已连接`);
  }

  stop() {
    this.discovery.stop();
    console.log('设备发现服务已停止');
  }
}

if (require.main === module) {
  const service = new DeviceDiscoveryService();
  service.start();

  process.on('SIGINT', () => {
    service.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    service.stop();
    process.exit(0);
  });
}

module.exports = DeviceDiscoveryService;
