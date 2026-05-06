const dgram = require('dgram');
const config = require('./config');

// 响应服务器发出的 UDP 广播发现请求
class DiscoveryResponder {
  constructor(deviceId) {
    this.deviceId = deviceId;
    this.socket = null;
  }

  start() {
    this.socket = dgram.createSocket('udp4');

    this.socket.on('error', (err) => {
      // 端口冲突（与服务器同机运行时）不影响主功能，仅警告
      if (err.code === 'EADDRINUSE') {
        console.warn(`[发现] UDP 端口 ${config.discoveryPort} 已被占用，跳过发现响应（不影响其他功能）`);
        this.socket.close();
        this.socket = null;
      } else {
        console.error('[发现] UDP 错误:', err.message);
      }
    });

    this.socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'discovery_request') {
          this.respond(rinfo);
        }
      } catch {}
    });

    this.socket.bind(config.discoveryPort, '0.0.0.0', () => {
      this.socket.setBroadcast(true);
      console.log(`[发现] UDP 响应器已启动，监听端口 ${config.discoveryPort}`);
    });
  }

  stop() {
    if (this.socket) {
      try { this.socket.close(); } catch {}
    }
  }

  respond(rinfo) {
    if (!this.socket) return;

    const response = Buffer.from(JSON.stringify({
      deviceId:        this.deviceId,
      name:            config.deviceName,
      deviceType:      config.deviceType,
      model:           config.deviceModel,
      macAddress:      config.macAddress,
      serialNumber:    config.serialNumber,
      ipAddress:       config.localIp,
      port:            config.devicePort,
      firmwareVersion: config.firmwareVersion,
      capabilities: {
        audioPlayback: true,
        tts:           config.ttsEngine !== 'none',
        interrupt:     true,
      },
    }));

    // 单播回应给服务器
    this.socket.send(response, 0, response.length, rinfo.port, rinfo.address, (err) => {
      if (err) console.error('[发现] 响应发送失败:', err.message);
    });
  }
}

module.exports = DiscoveryResponder;
