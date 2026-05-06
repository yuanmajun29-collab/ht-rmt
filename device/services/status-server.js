const http = require('http');
const config = require('./config');
const player = require('./player');

// 轻量级 HTTP 状态服务，平台可直连查询设备实时状态
class StatusServer {
  constructor(deviceId) {
    this.deviceId = deviceId;
    this.server = null;
    this.startTime = Date.now();
  }

  start() {
    this.server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (req.method === 'GET' && req.url === '/status') {
        res.writeHead(200);
        res.end(JSON.stringify(this._buildStatus()));
        return;
      }

      if (req.method === 'POST' && req.url === '/stop') {
        player.stop();
        res.writeHead(200);
        res.end(JSON.stringify({ message: '已停止播放' }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not Found' }));
    });

    this.server.on('error', (err) => {
      console.error(`[状态服务] 启动失败: ${err.message}`);
    });

    this.server.listen(config.devicePort, '0.0.0.0', () => {
      console.log(`[状态服务] 已启动，端口 ${config.devicePort}`);
    });
  }

  stop() {
    if (this.server) this.server.close();
  }

  _buildStatus() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      deviceId:        this.deviceId,
      name:            config.deviceName,
      deviceType:      config.deviceType,
      model:           config.deviceModel,
      firmwareVersion: config.firmwareVersion,
      ipAddress:       config.localIp,
      macAddress:      config.macAddress,
      audioBackend:    config.audioBackend,
      ttsEngine:       config.ttsEngine,
      player:          player.getStatus(),
      uptime,
      uptimeHuman:     `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
      timestamp:       new Date().toISOString(),
    };
  }
}

module.exports = StatusServer;
