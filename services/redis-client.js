const redis = require('redis');
const config = require('../config/config');

class RedisClient {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  async connect() {
    if (!config.get('redis.enabled')) {
      console.log('Redis 未启用');
      return false;
    }

    try {
      this.client = redis.createClient({
        url: config.get('redis.url'),
        db: config.get('redis.db'),
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis 连接错误:', err);
      });

      this.client.on('connect', () => {
        console.log('Redis 已连接');
        this.connected = true;
      });

      await this.client.connect();
      return true;
    } catch (err) {
      console.error('Redis 连接失败:', err);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.connected = false;
    }
  }

  async set(key, value, ttl = null) {
    if (!this.connected) return false;
    try {
      const options = ttl ? { EX: ttl } : {};
      await this.client.set(key, JSON.stringify(value), options);
      return true;
    } catch (err) {
      console.error('Redis 写入失败:', err);
      return false;
    }
  }

  async get(key) {
    if (!this.connected) return null;
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      console.error('Redis 读取失败:', err);
      return null;
    }
  }

  async del(key) {
    if (!this.connected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (err) {
      console.error('Redis 删除失败:', err);
      return false;
    }
  }

  async exists(key) {
    if (!this.connected) return false;
    try {
      const exists = await this.client.exists(key);
      return exists > 0;
    } catch (err) {
      console.error('Redis 检查失败:', err);
      return false;
    }
  }

  async hset(key, field, value) {
    if (!this.connected) return false;
    try {
      await this.client.hSet(key, field, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('Redis HSET 失败:', err);
      return false;
    }
  }

  async hget(key, field) {
    if (!this.connected) return null;
    try {
      const value = await this.client.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      console.error('Redis HGET 失败:', err);
      return null;
    }
  }

  isConnected() {
    return this.connected;
  }
}

module.exports = new RedisClient();
