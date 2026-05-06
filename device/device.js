require('dotenv').config();
const config        = require('./services/config');
const Registration  = require('./services/registration');
const DiscoveryResponder = require('./services/discovery');
const Heartbeat     = require('./services/heartbeat');
const Commander     = require('./services/commander');
const StatusServer  = require('./services/status-server');
const player        = require('./services/player');

async function main() {
  console.log('\n========================================');
  console.log('  HT-RMT IP 音柱设备端 v1.0.0');
  console.log(`  设备名称 : ${config.deviceName}`);
  console.log(`  型号     : ${config.deviceModel}`);
  console.log(`  固件版本 : ${config.firmwareVersion}`);
  console.log(`  本机 IP  : ${config.localIp}`);
  console.log(`  服务器   : ${config.serverUrl}`);
  console.log(`  音频后端 : ${config.audioBackend}`);
  console.log(`  TTS 引擎 : ${config.ttsEngine}`);
  console.log('========================================\n');

  // 1. 向管理平台注册（失败自动重试）
  const registration = new Registration();
  const deviceId = await registration.register();

  // 2. 启动 UDP 发现响应器（响应服务器广播）
  const discovery = new DiscoveryResponder(deviceId);
  discovery.start();

  // 3. 启动心跳服务
  const heartbeat = new Heartbeat(deviceId);
  heartbeat.start();

  // 4. 启动命令轮询执行器
  const commander = new Commander(deviceId);
  commander.start();

  // 5. 启动本机 HTTP 状态服务
  const statusServer = new StatusServer(deviceId);
  statusServer.start();

  console.log(`\n[设备] 全部服务已启动，设备 ID: ${deviceId}\n`);

  // 优雅关闭
  const shutdown = async (signal) => {
    console.log(`\n[设备] 收到 ${signal}，正在关闭...`);
    heartbeat.stop();
    commander.stop();
    discovery.stop();
    statusServer.stop();
    player.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('[设备] 未捕获异常:', err.message);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[设备] 未处理的 Promise 拒绝:', reason);
  });
}

main().catch(err => {
  console.error('[设备] 启动失败:', err.message);
  process.exit(1);
});
