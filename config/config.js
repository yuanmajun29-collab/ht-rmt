const fs = require('fs');
const path = require('path');
require('dotenv').config();

class ConfigManager {
  constructor() {
    this.config = {};
    this.loadConfig();
  }

  loadConfig() {
    const defaultConfigPath = path.join(__dirname, 'default.json');
    const localConfigPath = path.join(__dirname, `${process.env.NODE_ENV || 'development'}.json`);
    
    try {
      const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
      this.config = JSON.parse(JSON.stringify(defaultConfig));
    } catch (err) {
      console.error('加载默认配置失败:', err);
      process.exit(1);
    }

    if (fs.existsSync(localConfigPath)) {
      try {
        const localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
        this.config = this.merge(this.config, localConfig);
      } catch (err) {
        console.warn(`加载环境配置文件 ${localConfigPath} 失败:`, err);
      }
    }

    this.applyEnvOverrides();
  }

  applyEnvOverrides() {
    if (process.env.PORT) this.config.server.port = parseInt(process.env.PORT);
    if (process.env.NODE_ENV) this.config.server.env = process.env.NODE_ENV;
    if (process.env.INSTANCE_ID) this.config.instanceId = process.env.INSTANCE_ID;
    if (process.env.DATABASE_PATH) this.config.database.path = process.env.DATABASE_PATH;
    if (process.env.CLUSTER_MODE) this.config.clustering.enabled = process.env.CLUSTER_MODE === 'true';
    if (process.env.MULTIENANT_ENABLED) this.config.multiTenant.enabled = process.env.MULTIENANT_ENABLED === 'true';
    if (process.env.DEVICE_DISCOVERY_ENABLED) this.config.deviceDiscovery.enabled = process.env.DEVICE_DISCOVERY_ENABLED === 'true';
    if (process.env.REDIS_ENABLED) this.config.redis.enabled = process.env.REDIS_ENABLED === 'true';
    if (process.env.REDIS_URL) this.config.redis.url = process.env.REDIS_URL;
    if (process.env.JWT_SECRET) this.config.jwt.secret = process.env.JWT_SECRET;
    if (process.env.LOCALE) this.config.platform.locale = process.env.LOCALE;
    if (process.env.LOG_LEVEL) this.config.logLevel = process.env.LOG_LEVEL;
  }

  merge(target, source) {
    for (const key in source) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        target[key] = this.merge(target[key] || {}, source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  get(path, defaultValue) {
    const keys = path.split('.');
    let value = this.config;
    for (const key of keys) {
      value = value?.[key];
    }
    return value !== undefined ? value : defaultValue;
  }

  toJSON() {
    return JSON.parse(JSON.stringify(this.config));
  }
}

module.exports = new ConfigManager();
