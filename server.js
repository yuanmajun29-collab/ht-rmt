const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const Database = require('better-sqlite3');
const config = require('./config/config');
const TenantManager = require('./services/tenant-manager');
const DeviceManager = require('./services/device-manager');
const DeviceDiscovery = require('./services/device-discovery');
const Scheduler = require('./services/scheduler');
const redisClient = require('./services/redis-client');

const app = express();
const port = config.get('server.port');
const JWT_SECRET = config.get('jwt.secret');
const dataDir = config.get('database.path').split('/').slice(0, -1).join('/');
const dbPath = config.get('database.path');

if (JWT_SECRET === 'change-me-in-production' && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET 未配置，生产环境禁止使用默认密钥，请设置环境变量 JWT_SECRET');
  process.exit(1);
}

function loadLocale(locale) {
  try {
    const localePath = path.join(__dirname, 'locales', `${locale}.json`);
    if (fs.existsSync(localePath)) {
      return JSON.parse(fs.readFileSync(localePath, 'utf8'));
    }
  } catch (err) {
    console.warn(`加载本地化文件失败: ${locale}`, err);
  }
  return {};
}

const i18n = loadLocale(config.get('platform.locale') || 'zh_CN');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

function initDb() {
  // 首先创建租户表（如果启用多租户）
  if (config.get('multiTenant.enabled')) {
    db.prepare(`CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS tenant_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, key),
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS tenant_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, user_id),
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )`).run();

    const defaultTenant = db.prepare('SELECT id FROM tenants WHERE id = ?').get(config.get('multiTenant.defaultTenant'));
    if (!defaultTenant) {
      db.prepare('INSERT INTO tenants (id, name, description) VALUES (?, ?, ?)').run(
        config.get('multiTenant.defaultTenant'),
        'Default Tenant',
        'Platform default tenant'
      );
    }
  }

  // 创建用户表
  if (config.get('multiTenant.enabled')) {
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, username),
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )`).run();
  } else {
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();
  }

  // 创建IP表
  if (config.get('multiTenant.enabled')) {
    db.prepare(`CREATE TABLE IF NOT EXISTS ips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      image TEXT NOT NULL,
      audio_tone INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )`).run();
  } else {
    db.prepare(`CREATE TABLE IF NOT EXISTS ips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      image TEXT NOT NULL,
      audio_tone INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();
  }

  // 创建其他表
  db.prepare(`CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, ip_id)
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ip_id INTEGER NOT NULL,
    played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  if (config.get('multiTenant.enabled')) {
    db.prepare(`CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      ip_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )`).run();
  } else {
    db.prepare(`CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      ip_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();
  }

  // 定时播放计划
  db.prepare(`CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    ip_id INTEGER,
    device_ids TEXT NOT NULL DEFAULT '[]',
    repeat_type TEXT NOT NULL DEFAULT 'once',
    scheduled_date TEXT,
    scheduled_time TEXT NOT NULL,
    days_of_week TEXT NOT NULL DEFAULT '[]',
    duration INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'active',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  // 播报日志（口播/插播/定时）
  db.prepare(`CREATE TABLE IF NOT EXISTS broadcast_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT,
    ip_id INTEGER,
    content TEXT,
    device_ids TEXT NOT NULL DEFAULT '[]',
    priority INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'sent',
    schedule_id INTEGER,
    triggered_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  // 设备命令队列（设备轮询此表获取待执行命令）
  db.prepare(`CREATE TABLE IF NOT EXISTS device_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    command_type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'pending',
    broadcast_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acked_at TEXT
  )`).run();

  // 创建默认用户和初始IP
  const tenantId = config.get('multiTenant.defaultTenant') || 'default';
  const adminUser = db.prepare(config.get('multiTenant.enabled') ? 
    'SELECT id FROM users WHERE tenant_id = ? AND username = ?' :
    'SELECT id FROM users WHERE username = ?'
  ).get(config.get('multiTenant.enabled') ? tenantId : undefined, 'admin');

  if (!adminUser) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    if (config.get('multiTenant.enabled')) {
      db.prepare('INSERT INTO users (tenant_id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(tenantId, 'admin', passwordHash, 'admin');
    } else {
      db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', passwordHash, 'admin');
    }
  }

  const count = db.prepare(config.get('multiTenant.enabled') ?
    'SELECT COUNT(*) AS count FROM ips WHERE tenant_id = ?' :
    'SELECT COUNT(*) AS count FROM ips'
  ).get(config.get('multiTenant.enabled') ? tenantId : undefined).count;

  if (count === 0) {
    if (config.get('multiTenant.enabled')) {
      const insertIp = db.prepare('INSERT INTO ips (tenant_id, name, description, image, audio_tone) VALUES (?, ?, ?, ?, ?)');
      insertIp.run(tenantId, '星愿音柱', '以梦幻 IP 声音为基础的音柱，支持声音预览和多场景切换。', '/assets/ip-pill-1.svg', 330);
      insertIp.run(tenantId, '次元音柱', '面向年轻用户的二次元 IP 音柱，集成角色声音和主题内容。', '/assets/ip-pill-2.svg', 420);
      insertIp.run(tenantId, '怀旧音柱', '经典 IP 音柱，重现复古风格与怀旧语音。', '/assets/ip-pill-3.svg', 260);
    } else {
      const insertIp = db.prepare('INSERT INTO ips (name, description, image, audio_tone) VALUES (?, ?, ?, ?)');
      insertIp.run('星愿音柱', '以梦幻 IP 声音为基础的音柱，支持声音预览和多场景切换。', '/assets/ip-pill-1.svg', 330);
      insertIp.run('次元音柱', '面向年轻用户的二次元 IP 音柱，集成角色声音和主题内容。', '/assets/ip-pill-2.svg', 420);
      insertIp.run('怀旧音柱', '经典 IP 音柱，重现复古风格与怀旧语音。', '/assets/ip-pill-3.svg', 260);
    }
  }
}

initDb();

const tenantManager = config.get('multiTenant.enabled') ? new TenantManager(db) : null;
const deviceManager = new DeviceManager(db);

let deviceDiscovery = null;
if (config.get('deviceDiscovery.enabled')) {
  deviceDiscovery = new DeviceDiscovery({
    port: config.get('deviceDiscovery.port'),
    interval: config.get('deviceDiscovery.interval'),
    onDeviceDiscovered: (device) => {
      console.log(`[发现] 新设备: ${device.name} (${device.deviceId})`);
    }
  });
  deviceDiscovery.start();
}

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 初始化 Redis (可选)
(async () => {
  if (config.get('redis.enabled')) {
    await redisClient.connect();
  }
})();

function getCurrentUser(req) {
  let token = req.cookies.token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7);
  }
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, role, tenant_id FROM users WHERE id = ?').get(payload.id);
    return user;
  } catch (err) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: i18n.auth?.unauthorized || '请先登录' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: i18n.error?.forbidden || '禁止访问' });
    }
    next();
  });
}

function createToken(user) {
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: config.get('jwt.expiresIn') });
  return token;
}

function attachFavorites(ips, userId) {
  if (!userId) return ips.map(ip => ({ ...ip, isFavorite: false }));
  const favorites = db.prepare('SELECT ip_id FROM favorites WHERE user_id = ?').all(userId).map(row => row.ip_id);
  return ips.map(ip => ({ ...ip, isFavorite: favorites.includes(ip.id) }));
}

app.get('/api/profile', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.json({ user: null, tenant: null });
  }
  const tenant = tenantManager ? tenantManager.getTenant(user.tenant_id) : null;
  res.json({ user, tenant });
});

app.post('/api/register', (req, res) => {
  const { username, password, tenantId } = req.body;
  if (!username || !password || username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: '用户名至少 3 位，密码至少 6 位' });
  }

  const finalTenantId = tenantId || config.get('multiTenant.defaultTenant');
  if (tenantManager && !tenantManager.getTenant(finalTenantId)) {
    return res.status(400).json({ error: '租户不存在' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE tenant_id = ? AND username = ?').get(finalTenantId, username);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const passwordHash = bcrypt.hashSync(password, config.get('security.passwordHashRounds'));
  const result = db.prepare('INSERT INTO users (tenant_id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(finalTenantId, username, passwordHash, 'user');
  const user = { id: result.lastInsertRowid, username, role: 'user', tenant_id: finalTenantId };

  if (tenantManager) {
    tenantManager.addTenantMember(finalTenantId, user.id, 'member');
  }

  const token = createToken(user);
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ user, token });
});

app.post('/api/login', (req, res) => {
  const { username, password, tenantId } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const finalTenantId = tenantId || config.get('multiTenant.defaultTenant');
  const user = db.prepare('SELECT id, username, password_hash, role, tenant_id FROM users WHERE tenant_id = ? AND username = ?').get(finalTenantId, username);
  
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(400).json({ error: '用户名或密码错误' });
  }

  const token = createToken(user);
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ user: { id: user.id, username: user.username, role: user.role, tenant_id: user.tenant_id }, token });
});

app.post('/api/logout', (req, res) => {
  res.cookie('token', '', { httpOnly: true, maxAge: 0 });
  res.json({ message: '已退出登录' });
});

app.get('/api/ips', (req, res) => {
  const user = getCurrentUser(req);
  const tenantId = user?.tenant_id || config.get('multiTenant.defaultTenant');
  const ips = db.prepare('SELECT id, name, description, image, audio_tone FROM ips WHERE tenant_id = ? ORDER BY id').all(tenantId);
  res.json({ ips: attachFavorites(ips, user?.id) });
});

app.get('/api/favorites', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT ips.id, ips.name, ips.description, ips.image, ips.audio_tone
    FROM ips
    JOIN favorites ON ips.id = favorites.ip_id
    WHERE favorites.user_id = ? AND ips.tenant_id = ?
    ORDER BY favorites.created_at DESC
  `).all(req.user.id, req.user.tenant_id);
  res.json({ favorites: rows });
});

app.post('/api/favorites/:ipId', requireAuth, (req, res) => {
  const ipId = Number(req.params.ipId);
  const ip = db.prepare('SELECT id FROM ips WHERE id = ? AND tenant_id = ?').get(ipId, req.user.tenant_id);
  if (!ip) {
    return res.status(404).json({ error: '音柱未找到' });
  }

  const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND ip_id = ?').get(req.user.id, ipId);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE id = ?').run(existing.id);
    return res.json({ message: '已取消收藏', favorite: false });
  }

  db.prepare('INSERT INTO favorites (user_id, ip_id) VALUES (?, ?)').run(req.user.id, ipId);
  res.json({ message: '已加入收藏', favorite: true });
});

app.post('/api/play', (req, res) => {
  const { ipId } = req.body;
  const user = getCurrentUser(req);
  const tenantId = user?.tenant_id || config.get('multiTenant.defaultTenant');
  const ip = db.prepare('SELECT id, name, audio_tone FROM ips WHERE id = ? AND tenant_id = ?').get(ipId, tenantId);
  if (!ip) {
    return res.status(404).json({ error: '音柱未找到' });
  }

  db.prepare('INSERT INTO plays (user_id, ip_id) VALUES (?, ?)').run(user?.id || null, ipId);
  res.json({ message: `开始播放 ${ip.name}。`, audioTone: ip.audio_tone });
});

app.post('/api/feedback', (req, res) => {
  const { ipId, feedback } = req.body;
  if (!ipId || !feedback || !feedback.trim()) {
    return res.status(400).json({ error: '请提供音柱 ID 和反馈内容' });
  }

  const user = getCurrentUser(req);
  const tenantId = user?.tenant_id || config.get('multiTenant.defaultTenant');
  const ip = db.prepare('SELECT id FROM ips WHERE id = ? AND tenant_id = ?').get(ipId, tenantId);
  if (!ip) {
    return res.status(404).json({ error: '音柱未找到' });
  }

  db.prepare('INSERT INTO feedback (user_id, tenant_id, ip_id, message) VALUES (?, ?, ?, ?)').run(user?.id || null, tenantId, ipId, feedback.trim());
  res.json({ message: '反馈已收到，感谢您的提交。' });
});

// ========== 设备管理 API ==========
app.post('/api/devices/register', (req, res) => {
  const deviceInfo = req.body;
  if (!deviceInfo.deviceId || !deviceInfo.deviceType) {
    return res.status(400).json({ error: '设备 ID 和类型是必需的' });
  }

  const user = getCurrentUser(req);
  const tenantId = user?.tenant_id || config.get('multiTenant.defaultTenant');

  try {
    const device = deviceManager.registerDevice(tenantId, deviceInfo);
    res.json({ message: '设备已注册', device });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/devices/:deviceId/heartbeat', (req, res) => {
  const deviceId = req.params.deviceId;
  try {
    deviceManager.updateDeviceHeartbeat(deviceId);
    res.json({ message: '心跳已记录' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/devices', requireAuth, (req, res) => {
  try {
    const devices = deviceManager.getDevicesByTenant(req.user.tenant_id);
    res.json({ devices });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/devices/:deviceId', requireAuth, (req, res) => {
  try {
    const device = deviceManager.getDevice(req.params.deviceId);
    if (!device || device.tenant_id !== req.user.tenant_id) {
      return res.status(404).json({ error: '设备未找到' });
    }
    res.json({ device });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/devices/:deviceId', requireAuth, (req, res) => {
  try {
    const device = deviceManager.getDevice(req.params.deviceId);
    if (!device || device.tenant_id !== req.user.tenant_id) {
      return res.status(404).json({ error: '设备未找到' });
    }
    deviceManager.removeDevice(req.params.deviceId);
    res.json({ message: '设备已删除' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ========== 租户管理 API ==========
app.get('/api/tenants', requireAdmin, (req, res) => {
  if (!tenantManager) {
    return res.status(400).json({ error: '多租户功能未启用' });
  }
  try {
    const tenants = tenantManager.getAllTenants();
    res.json({ tenants });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tenants', requireAdmin, (req, res) => {
  if (!tenantManager) {
    return res.status(400).json({ error: '多租户功能未启用' });
  }
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: '租户名称是必需的' });
  }
  try {
    const tenant = tenantManager.createTenant(undefined, name, description);
    res.json({ message: '租户已创建', tenant });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tenants/:tenantId', requireAuth, (req, res) => {
  if (!tenantManager) {
    return res.status(400).json({ error: '多租户功能未启用' });
  }
  try {
    const tenant = tenantManager.getTenant(req.params.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: '租户未找到' });
    }
    if (req.user.tenant_id !== req.params.tenantId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '禁止访问此租户' });
    }
    res.json({ tenant });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ========== 管理员 IP 管理 API ==========
app.get('/api/admin/ips', requireAdmin, (req, res) => {
  const ips = db.prepare('SELECT id, name, description, image, audio_tone, tenant_id FROM ips WHERE tenant_id = ? ORDER BY id').all(req.user.tenant_id);
  res.json({ ips });
});

app.post('/api/admin/ips', requireAdmin, (req, res) => {
  const { name, description, image, audioTone } = req.body;
  if (!name || !description || !image || !audioTone) {
    return res.status(400).json({ error: '管理员需要填写全部字段' });
  }
  const result = db.prepare('INSERT INTO ips (tenant_id, name, description, image, audio_tone) VALUES (?, ?, ?, ?, ?)').run(req.user.tenant_id, name, description, image, Number(audioTone));
  res.json({ message: '新 IP 已创建', ip: { id: result.lastInsertRowid, name, description, image, audio_tone: Number(audioTone) } });
});

app.put('/api/admin/ips/:id', requireAdmin, (req, res) => {
  const ipId = Number(req.params.id);
  const { name, description, image, audioTone } = req.body;
  const ip = db.prepare('SELECT id FROM ips WHERE id = ? AND tenant_id = ?').get(ipId, req.user.tenant_id);
  if (!ip) {
    return res.status(404).json({ error: '音柱未找到' });
  }
  db.prepare('UPDATE ips SET name = ?, description = ?, image = ?, audio_tone = ? WHERE id = ?').run(name, description, image, Number(audioTone), ipId);
  res.json({ message: '音柱已更新' });
});

app.delete('/api/admin/ips/:id', requireAdmin, (req, res) => {
  const ipId = Number(req.params.id);
  const ip = db.prepare('SELECT id FROM ips WHERE id = ? AND tenant_id = ?').get(ipId, req.user.tenant_id);
  if (!ip) {
    return res.status(404).json({ error: '音柱未找到' });
  }
  db.prepare('DELETE FROM ips WHERE id = ?').run(ipId);
  db.prepare('DELETE FROM favorites WHERE ip_id = ?').run(ipId);
  db.prepare('DELETE FROM plays WHERE ip_id = ?').run(ipId);
  db.prepare('DELETE FROM feedback WHERE ip_id = ?').run(ipId);
  res.json({ message: '音柱已删除' });
});

// ========== 平台信息 API ==========
app.get('/api/platform/info', (req, res) => {
  res.json({
    platform: {
      name: config.get('platform.name'),
      version: config.get('platform.version'),
      multiTenantEnabled: config.get('multiTenant.enabled'),
      deviceDiscoveryEnabled: config.get('deviceDiscovery.enabled'),
      clusteringEnabled: config.get('clustering.enabled'),
      locale: config.get('platform.locale'),
      instanceId: process.env.INSTANCE_ID || 'default'
    }
  });
});

// ========== 广播辅助函数 ==========
function sendBroadcast(tenantId, type, { name, ipId, content, deviceIds, priority, scheduleId, triggeredBy }) {
  let targets = deviceIds;
  if (!targets || targets === 'all' || targets.length === 0) {
    targets = db.prepare('SELECT id FROM devices WHERE tenant_id = ?').all(tenantId).map(d => d.id);
  }

  const result = db.prepare(`
    INSERT INTO broadcast_log (tenant_id, type, name, ip_id, content, device_ids, priority, schedule_id, triggered_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, type, name, ipId || null, content || null, JSON.stringify(targets), priority, scheduleId || null, triggeredBy || null);

  const broadcastId = result.lastInsertRowid;
  const cmdType = type === 'interrupt' ? 'interrupt' : type === 'live' ? 'announce' : 'play';
  const payload = JSON.stringify({ ipId, content, priority, type });
  const stmt = db.prepare('INSERT INTO device_commands (device_id, command_type, payload, priority, broadcast_id) VALUES (?, ?, ?, ?, ?)');
  for (const deviceId of targets) {
    stmt.run(deviceId, cmdType, payload, priority, broadcastId);
  }

  return { broadcastId, targets };
}

// ========== 定时播放计划 API ==========
app.get('/api/schedules', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM schedules WHERE tenant_id = ? ORDER BY created_at DESC').all(req.user.tenant_id);
  res.json({ schedules: rows });
});

app.post('/api/schedules', requireAuth, (req, res) => {
  const { name, ipId, deviceIds, repeatType, scheduledDate, scheduledTime, daysOfWeek, duration } = req.body;
  if (!name || !scheduledTime) {
    return res.status(400).json({ error: '计划名称和时间为必填项' });
  }
  if (!/^\d{2}:\d{2}$/.test(scheduledTime)) {
    return res.status(400).json({ error: '时间格式应为 HH:MM' });
  }
  const result = db.prepare(`
    INSERT INTO schedules (tenant_id, name, ip_id, device_ids, repeat_type, scheduled_date, scheduled_time, days_of_week, duration, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.tenant_id, name, ipId || null,
    JSON.stringify(deviceIds || []), repeatType || 'once',
    scheduledDate || null, scheduledTime,
    JSON.stringify(daysOfWeek || []),
    duration || 60, req.user.id
  );
  res.json({ message: '计划已创建', id: result.lastInsertRowid });
});

app.put('/api/schedules/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const s = db.prepare('SELECT id FROM schedules WHERE id = ? AND tenant_id = ?').get(id, req.user.tenant_id);
  if (!s) return res.status(404).json({ error: '计划未找到' });
  const { name, ipId, deviceIds, repeatType, scheduledDate, scheduledTime, daysOfWeek, duration } = req.body;
  db.prepare(`
    UPDATE schedules SET name=?, ip_id=?, device_ids=?, repeat_type=?, scheduled_date=?,
    scheduled_time=?, days_of_week=?, duration=?, updated_at=? WHERE id=?
  `).run(name, ipId || null, JSON.stringify(deviceIds || []), repeatType || 'once',
    scheduledDate || null, scheduledTime, JSON.stringify(daysOfWeek || []),
    duration || 60, new Date().toISOString(), id);
  res.json({ message: '计划已更新' });
});

app.delete('/api/schedules/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const s = db.prepare('SELECT id FROM schedules WHERE id = ? AND tenant_id = ?').get(id, req.user.tenant_id);
  if (!s) return res.status(404).json({ error: '计划未找到' });
  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
  res.json({ message: '计划已删除' });
});

app.post('/api/schedules/:id/toggle', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const s = db.prepare('SELECT id, status FROM schedules WHERE id = ? AND tenant_id = ?').get(id, req.user.tenant_id);
  if (!s) return res.status(404).json({ error: '计划未找到' });
  const next = s.status === 'active' ? 'paused' : 'active';
  db.prepare('UPDATE schedules SET status = ?, updated_at = ? WHERE id = ?').run(next, new Date().toISOString(), id);
  res.json({ message: next === 'active' ? '计划已启用' : '计划已暂停', status: next });
});

// ========== 广播 API ==========
app.post('/api/broadcast/live', requireAuth, (req, res) => {
  const { content, deviceIds } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '口播内容不能为空' });
  }
  const result = sendBroadcast(req.user.tenant_id, 'live', {
    name: `口播 - ${req.user.username}`,
    content: content.trim(),
    deviceIds: deviceIds || [],
    priority: 3,
    triggeredBy: req.user.id,
  });
  res.json({ message: `口播已发送至 ${result.targets.length} 台设备`, ...result });
});

app.post('/api/broadcast/interrupt', requireAuth, (req, res) => {
  const { ipId, content, deviceIds } = req.body;
  if (!ipId && !content) {
    return res.status(400).json({ error: '请指定音柱或内容' });
  }
  const result = sendBroadcast(req.user.tenant_id, 'interrupt', {
    name: `插播 - ${req.user.username}`,
    ipId: ipId || null,
    content: content || null,
    deviceIds: deviceIds || [],
    priority: 1,
    triggeredBy: req.user.id,
  });
  res.json({ message: `插播已发送至 ${result.targets.length} 台设备`, ...result });
});

app.get('/api/broadcast/log', requireAuth, (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const rows = db.prepare('SELECT * FROM broadcast_log WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?').all(req.user.tenant_id, limit);
  res.json({ log: rows });
});

// ========== 设备命令队列（设备侧轮询） ==========
app.get('/api/devices/:deviceId/commands', (req, res) => {
  const cmds = db.prepare(`
    SELECT * FROM device_commands WHERE device_id = ? AND status = 'pending'
    ORDER BY priority ASC, created_at ASC LIMIT 10
  `).all(req.params.deviceId);
  res.json({ commands: cmds });
});

app.post('/api/devices/:deviceId/commands/:cmdId/ack', (req, res) => {
  db.prepare("UPDATE device_commands SET status = 'acknowledged', acked_at = ? WHERE id = ? AND device_id = ?")
    .run(new Date().toISOString(), Number(req.params.cmdId), req.params.deviceId);
  res.json({ message: '命令已确认' });
});

// ========== 调度器初始化 ==========
const scheduler = new Scheduler(db, (schedule) => {
  const tenantId = schedule.tenant_id;
  sendBroadcast(tenantId, 'scheduled', {
    name: schedule.name,
    ipId: schedule.ip_id,
    deviceIds: JSON.parse(schedule.device_ids || '[]'),
    priority: 5,
    scheduleId: schedule.id,
  });
});
scheduler.start();

const server = app.listen(port, () => {
  console.log(`\n========================================`);
  console.log(`${config.get('platform.name')} v${config.get('platform.version')}`);
  console.log(`已启动，访问 http://localhost:${port}`);
  console.log(`实例ID: ${process.env.INSTANCE_ID || 'default'}`);
  console.log(`多租户: ${config.get('multiTenant.enabled') ? '✓ 启用' : '✗ 禁用'}`);
  console.log(`设备发现: ${config.get('deviceDiscovery.enabled') ? '✓ 启用' : '✗ 禁用'}`);
  console.log(`集群模式: ${config.get('clustering.enabled') ? '✓ 启用' : '✗ 禁用'}`);
  console.log(`========================================\n`);
});

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，优雅关闭中...');
  server.close(() => {
    scheduler.stop();
    if (deviceDiscovery) deviceDiscovery.stop();
    if (redisClient.isConnected()) redisClient.disconnect();
    db.close();
    process.exit(0);
  });
});
