const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const config = require('./config');

const STATE_FILE = path.join(__dirname, '../device-state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

class Registration {
  constructor() {
    this.api = axios.create({ baseURL: config.serverUrl, timeout: 8000 });
    this.state = loadState();
  }

  get deviceId() {
    return this.state.deviceId;
  }

  async register() {
    // 生成稳定的设备 ID（基于 MAC 地址，保证重启不变）
    if (!this.state.deviceId) {
      const base = config.macAddress || config.serialNumber || uuidv4();
      this.state.deviceId = `device-${base.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}-${uuidv4().slice(0, 8)}`;
      saveState(this.state);
    }

    const payload = {
      deviceId:        this.state.deviceId,
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
        schedule:      true,
      },
      metadata: {
        hostname: require('os').hostname(),
        platform: process.platform,
        nodeVersion: process.version,
      },
    };

    let attempts = 0;
    while (true) {
      attempts++;
      try {
        const { data } = await this.api.post('/api/devices/register', payload);
        console.log(`[注册] 成功 (第 ${attempts} 次尝试)，设备 ID: ${this.state.deviceId}`);
        return this.state.deviceId;
      } catch (err) {
        const msg = err.response?.data?.error || err.message;
        console.error(`[注册] 失败: ${msg}，${config.registerRetryInterval / 1000}s 后重试...`);
        await new Promise(r => setTimeout(r, config.registerRetryInterval));
      }
    }
  }
}

module.exports = Registration;
