const axios = require('axios');
const config = require('./config');
const player = require('./player');

class Commander {
  constructor(deviceId) {
    this.deviceId = deviceId;
    this.api = axios.create({ baseURL: config.serverUrl, timeout: 8000 });
    this.timer = null;
    this.processing = false;
  }

  start() {
    this.timer = setInterval(() => this.poll(), config.commandPollInterval);
    console.log(`[命令器] 已启动，每 ${config.commandPollInterval / 1000}s 轮询`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async poll() {
    if (this.processing) return;
    this.processing = true;
    try {
      const { data } = await this.api.get(`/api/devices/${this.deviceId}/commands`);
      const commands = data.commands || [];

      // 按优先级排序后依次执行
      commands.sort((a, b) => a.priority - b.priority);
      for (const cmd of commands) {
        await this.execute(cmd);
        await this.ack(cmd.id);
      }
    } catch (err) {
      if (err.code !== 'ECONNREFUSED') {
        console.error('[命令器] 轮询失败:', err.message);
      }
    } finally {
      this.processing = false;
    }
  }

  async execute(cmd) {
    let payload = {};
    try { payload = JSON.parse(cmd.payload || '{}'); } catch {}

    console.log(`[命令器] 执行 [${cmd.command_type}] priority=${cmd.priority}`, {
      ipName: payload.ipName, audioTone: payload.audioTone, content: payload.content?.slice(0, 30),
    });

    switch (cmd.command_type) {
      case 'play':
        player.play({
          audioTone: payload.audioTone,
          ipName:    payload.ipName,
          type:      'play',
          priority:  cmd.priority,
          duration:  payload.duration || 5,
        });
        break;

      case 'interrupt':
        player.play({
          audioTone: payload.audioTone,
          content:   payload.content,
          ipName:    payload.ipName,
          type:      'interrupt',
          priority:  1,
          duration:  payload.duration || 5,
        });
        break;

      case 'announce':
        player.play({
          content:  payload.content,
          type:     'announce',
          priority: cmd.priority,
          duration: payload.duration || 10,
        });
        break;

      case 'stop':
        player.stop();
        break;

      default:
        console.warn(`[命令器] 未知命令类型: ${cmd.command_type}`);
    }
  }

  async ack(cmdId) {
    try {
      await this.api.post(`/api/devices/${this.deviceId}/commands/${cmdId}/ack`);
    } catch (err) {
      console.error(`[命令器] 命令 ${cmdId} 确认失败:`, err.message);
    }
  }
}

module.exports = Commander;
