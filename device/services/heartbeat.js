const axios = require('axios');
const config = require('./config');

class Heartbeat {
  constructor(deviceId) {
    this.deviceId = deviceId;
    this.api = axios.create({ baseURL: config.serverUrl, timeout: 5000 });
    this.timer = null;
    this.consecutiveFails = 0;
  }

  start() {
    // 启动时立即发送一次
    this.send();
    this.timer = setInterval(() => this.send(), config.heartbeatInterval);
    console.log(`[心跳] 已启动，每 ${config.heartbeatInterval / 1000}s 发送一次`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async send() {
    try {
      await this.api.post(`/api/devices/${this.deviceId}/heartbeat`);
      if (this.consecutiveFails > 0) {
        console.log(`[心跳] 连接已恢复`);
      }
      this.consecutiveFails = 0;
    } catch (err) {
      this.consecutiveFails++;
      if (this.consecutiveFails === 1 || this.consecutiveFails % 5 === 0) {
        console.warn(`[心跳] 发送失败 (连续 ${this.consecutiveFails} 次): ${err.message}`);
      }
    }
  }
}

module.exports = Heartbeat;
