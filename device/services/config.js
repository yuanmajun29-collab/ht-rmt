require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const os = require('os');

function getMacAddress() {
  const ifaces = os.networkInterfaces();
  for (const name in ifaces) {
    for (const iface of ifaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac;
      }
    }
  }
  return null;
}

function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name in ifaces) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIp = getLocalIp();

module.exports = {
  serverUrl:             process.env.SERVER_URL || 'http://localhost:3000',
  deviceName:            process.env.DEVICE_NAME || `音柱设备-${os.hostname()}`,
  deviceType:            process.env.DEVICE_TYPE || 'audio-speaker',
  deviceModel:           process.env.DEVICE_MODEL || 'HT-RMT-100',
  firmwareVersion:       process.env.FIRMWARE_VERSION || '1.0.0',
  macAddress:            process.env.MAC_ADDRESS || getMacAddress(),
  serialNumber:          process.env.SERIAL_NUMBER || null,
  devicePort:            parseInt(process.env.DEVICE_PORT) || 8080,
  discoveryPort:         parseInt(process.env.DISCOVERY_PORT) || 5353,
  heartbeatInterval:     parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
  commandPollInterval:   parseInt(process.env.COMMAND_POLL_INTERVAL) || 5000,
  registerRetryInterval: parseInt(process.env.REGISTER_RETRY_INTERVAL) || 10000,
  audioBackend:          process.env.AUDIO_BACKEND || 'sox',
  ttsEngine:             process.env.TTS_ENGINE || 'espeak-ng',
  logLevel:              process.env.LOG_LEVEL || 'info',
  localIp,
};
