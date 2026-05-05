# HT-RMT IP 音柱平台 - 完整使用和部署方案

**版本**: 0.3.0  
**最后更新**: 2026-05-05  
**平台**: Node.js + Express + SQLite + Redis(可选)

---

## 目录

1. [项目概述](#项目概述)
2. [快速开始](#快速开始)
3. [详细配置](#详细配置)
4. [部署方案](#部署方案)
5. [运维指南](#运维指南)
6. [API 文档](#api-文档)
7. [常见问题](#常见问题)
8. [故障排查](#故障排查)

---

## 项目概述

### 功能特性

HT-RMT IP 音柱平台是一个功能完整的分布式音柱管理系统，支持：

| 功能类别 | 特性 |
|---------|------|
| **用户管理** | 用户注册、登录、退出、个人资料查看 |
| **内容管理** | IP 音柱浏览、试听、收藏/取消收藏 |
| **反馈系统** | 播放记录、用户反馈提交与查看 |
| **管理功能** | IP 管理面板、设备管理、租户管理 |
| **扩展性** | 多租户支持、集群模式、设备自动发现 |
| **本地化** | 中文(zh_CN)、英文(en_US) |
| **存储** | SQLite 持久化、Redis 会话(可选) |

### 系统架构

```
前端层 (Public)
    ↓
Express Web 服务器 (server.js)
    ├─ 认证与授权 (JWT)
    ├─ 租户管理 (TenantManager)
    ├─ 设备管理 (DeviceManager)
    └─ 设备发现 (DeviceDiscovery)
    ↓
数据层
    ├─ SQLite 数据库 (platform.db)
    ├─ Redis 会话存储 (可选)
    └─ 本地化文件 (locales)
```

### 支持的部署模式

- ✅ **开发模式**: 单机开发调试
- ✅ **生产模式**: 单机生产部署
- ✅ **集群模式**: 多进程负载均衡
- ✅ **分布式模式**: 多机器与设备发现

---

## 快速开始

### 环境要求

| 项目 | 版本要求 |
|------|---------|
| Node.js | >= 14.0.0 |
| npm | >= 6.0.0 |
| 操作系统 | Linux / macOS / Windows |
| 内存 | >= 256MB |
| 磁盘 | >= 100MB |

### 1. 安装依赖

```bash
# 进入项目目录
cd /workspaces/ht-rmt

# 安装 npm 依赖
npm install

# 可选：修复 npm 审计问题
npm audit fix
```

### 2. 环境配置

```bash
# 复制环境模板
cp .env.example .env

# 编辑 .env 文件（可选，使用默认配置也可运行）
# 重要配置项：
# - PORT=3000                          # 服务器端口
# - NODE_ENV=development               # 运行环境
# - JWT_SECRET=your-secret-key         # JWT 密钥
# - DATABASE_PATH=./data/platform.db   # 数据库路径
```

### 3. 启动应用

```bash
# 开发模式（带自动重启）
npm run dev:watch

# 生产模式
npm start

# 集群模式（可选）
npm run cluster

# 设备发现服务（可选）
npm run device-discovery
```

### 4. 访问应用

打开浏览器访问：
```
http://localhost:3000
```

### 5. 默认登录凭证

| 用户名 | 密码 | 角色 |
|-------|------|------|
| `admin` | `admin123` | 管理员 |

> ⚠️ **安全提示**: 首次登录后立即修改默认密码！

---

## 详细配置

### 配置文件层级

配置系统按以下优先级加载（高优先级覆盖低优先级）：

```
环境变量 (最高)
    ↓
development.json / production.json
    ↓
default.json (最低)
```

### 配置参数详解

#### 服务器配置 (`server`)

```json
{
  "server": {
    "port": 3000,              // Web 服务端口
    "host": "0.0.0.0",         // 绑定 IP 地址
    "trustProxy": false        // 是否信任代理
  }
}
```

**环境变量**: `PORT`, `NODE_ENV`

#### 数据库配置 (`database`)

```json
{
  "database": {
    "path": "./data/platform.db",  // SQLite 数据库路径
    "maxConnections": 5,           // 最大连接数
    "timeout": 5000                // 连接超时(ms)
  }
}
```

**环境变量**: `DATABASE_PATH`

#### JWT 配置 (`jwt`)

```json
{
  "jwt": {
    "secret": "change-me-in-production",    // JWT 密钥（重要！生产环境必改）
    "expiresIn": "7d",                      // 令牌过期时间
    "algorithm": "HS256"                    // 签名算法
  }
}
```

**环境变量**: `JWT_SECRET`

**生产环境配置示例**:
```bash
# 使用强密钥
export JWT_SECRET=$(openssl rand -base64 32)
```

#### 多租户配置 (`multiTenant`)

```json
{
  "multiTenant": {
    "enabled": true,           // 是否启用多租户
    "defaultTenant": "default",// 默认租户 ID
    "isolation": "database"    // 隔离级别: database / schema / row
  }
}
```

**环境变量**: `MULTIENANT_ENABLED`

#### 设备发现配置 (`deviceDiscovery`)

```json
{
  "deviceDiscovery": {
    "enabled": true,           // 是否启用设备发现
    "protocol": "mdns",        // 发现协议 (mdns / manual)
    "port": 5353,              // mDNS 监听端口
    "interval": 30000,         // 发现间隔(ms)
    "timeout": 5000            // 发现超时(ms)
  }
}
```

**环境变量**: `DEVICE_DISCOVERY_ENABLED`

#### Redis 配置 (`redis`)

```json
{
  "redis": {
    "enabled": false,          // 是否启用 Redis
    "url": "redis://localhost:6379",  // Redis 连接 URL
    "db": 0,                   // 数据库编号
    "sessionStorage": true     // 是否用 Redis 存储会话
  }
}
```

**环境变量**: `REDIS_ENABLED`, `REDIS_URL`

#### 集群模式配置 (`clustering`)

```json
{
  "clustering": {
    "enabled": false,          // 是否启用集群模式
    "numWorkers": 0,           // 工作进程数 (0 = CPU 核心数)
    "redisUrl": "redis://localhost:6379"  // 集群间通讯 Redis URL
  }
}
```

**环境变量**: `CLUSTER_MODE`

#### 本地化配置 (`localization` & `platform.locale`)

```json
{
  "platform": {
    "locale": "zh_CN"          // 默认语言: zh_CN / en_US
  },
  "localization": {
    "defaultLocale": "zh_CN",
    "availableLocales": ["zh_CN", "en_US"],
    "directory": "./locales"
  }
}
```

**环境变量**: `LOCALE`

#### 安全配置 (`security`)

```json
{
  "security": {
    "passwordMinLength": 6,    // 密码最小长度
    "passwordHashRounds": 10,  // bcrypt 轮数
    "corsEnabled": false,      // 是否启用 CORS
    "rateLimiting": false      // 是否启用速率限制
  }
}
```

### 配置示例

#### 开发环境配置

**文件**: `config/development.json`

```json
{
  "server": {
    "port": 3000
  },
  "database": {
    "path": "./data/dev.db"
  },
  "jwt": {
    "secret": "dev-secret-key-not-for-production"
  },
  "clustering": {
    "enabled": false
  },
  "redis": {
    "enabled": false
  }
}
```

#### 生产环境配置

**文件**: `config/production.json`

```json
{
  "server": {
    "port": 8080,
    "trustProxy": true
  },
  "database": {
    "path": "/var/lib/ht-rmt/platform.db",
    "maxConnections": 20
  },
  "jwt": {
    "expiresIn": "30d",
    "secret": "CHANGE_ME"
  },
  "redis": {
    "enabled": true,
    "url": "redis://redis-server:6379",
    "sessionStorage": true
  },
  "clustering": {
    "enabled": true,
    "numWorkers": 4,
    "redisUrl": "redis://redis-server:6379"
  },
  "security": {
    "corsEnabled": true,
    "rateLimiting": true
  }
}
```

---

## 部署方案

### 方案一: 本地开发部署（最简单）

适用于: 开发调试、小型测试

**步骤**:

```bash
# 1. 克隆/进入项目
cd /workspaces/ht-rmt

# 2. 安装依赖
npm install

# 3. 启动（自动重启）
npm run dev:watch
```

**访问**: http://localhost:3000

**优点**: 
- ✅ 快速启动
- ✅ 代码修改自动重启
- ✅ 易于调试

**缺点**:
- ❌ 单进程，并发能力弱
- ❌ 无法与外网共享
- ❌ 无持久化管理

---

### 方案二: 单机生产部署

适用于: 中小型生产环境

#### 2.1 使用 npm

```bash
# 1. 准备系统
mkdir -p /opt/ht-rmt
mkdir -p /var/log/ht-rmt
mkdir -p /var/lib/ht-rmt

# 2. 部署应用
cp -r /workspaces/ht-rmt/* /opt/ht-rmt/
cd /opt/ht-rmt
npm install --production

# 3. 配置环境变量
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
JWT_SECRET=$(openssl rand -base64 32)
DATABASE_PATH=/var/lib/ht-rmt/platform.db
Redis_ENABLED=true
REDIS_URL=redis://localhost:6379
EOF

# 4. 启动应用
npm start
```

#### 2.2 使用 PM2（推荐）

PM2 提供进程管理、日志、监控等功能。

**安装 PM2**:
```bash
npm install -g pm2
```

**创建配置文件**:

**文件**: `ecosystem.config.js`

```javascript
module.exports = {
  apps: [{
    name: 'ht-rmt',
    script: './server.js',
    instances: 4,                    // 启动 4 个实例
    exec_mode: 'cluster',            // 集群模式
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      JWT_SECRET: 'your-secret-key',
      DATABASE_PATH: '/var/lib/ht-rmt/platform.db',
      REDIS_ENABLED: 'true',
      REDIS_URL: 'redis://127.0.0.1:6379'
    },
    error_file: '/var/log/ht-rmt/error.log',
    out_file: '/var/log/ht-rmt/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
```

**启动与管理**:

```bash
# 启动应用
pm2 start ecosystem.config.js --env production

# 查看状态
pm2 status

# 查看日志
pm2 logs ht-rmt

# 重启
pm2 restart ht-rmt

# 停止
pm2 stop ht-rmt

# 重新加载（优雅重启）
pm2 reload ht-rmt

# 删除
pm2 delete ht-rmt

# 开机自启
pm2 startup
pm2 save
```

#### 2.3 使用 Systemd（最专业）

**创建 Systemd 服务文件**:

**文件**: `/etc/systemd/system/ht-rmt.service`

```ini
[Unit]
Description=HT-RMT IP Audio Column Platform
After=network.target redis.service

[Service]
Type=simple
User=ht-rmt
WorkingDirectory=/opt/ht-rmt
EnvironmentFile=/opt/ht-rmt/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/ht-rmt/output.log
StandardError=append:/var/log/ht-rmt/error.log

[Install]
WantedBy=multi-user.target
```

**创建专用用户**:

```bash
sudo useradd -r -s /bin/false ht-rmt
sudo chown -R ht-rmt:ht-rmt /opt/ht-rmt
sudo chown -R ht-rmt:ht-rmt /var/lib/ht-rmt
```

**启动与管理**:

```bash
# 重载 systemd 配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start ht-rmt

# 查看状态
sudo systemctl status ht-rmt

# 查看日志
sudo journalctl -u ht-rmt -f

# 停止
sudo systemctl stop ht-rmt

# 重启
sudo systemctl restart ht-rmt

# 开机自启
sudo systemctl enable ht-rmt
```

---

### 方案三: Docker 容器部署

适用于: 云平台、K8s、快速部署

#### 3.1 创建 Dockerfile

**文件**: `Dockerfile`

```dockerfile
# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --production

# 运行阶段
FROM node:18-alpine

WORKDIR /app

# 创建数据目录
RUN mkdir -p /app/data /app/logs

# 复制依赖
COPY --from=builder /app/node_modules ./node_modules

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 3000 5353

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# 启动应用
CMD ["npm", "start"]
```

#### 3.2 创建.dockerignore

**文件**: `.dockerignore`

```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.example
logs
data/*.db
```

#### 3.3 构建与运行

```bash
# 构建镜像
docker build -t ht-rmt:0.3.0 .

# 运行容器
docker run -d \
  --name ht-rmt \
  -p 3000:3000 \
  -p 5353:5353/udp \
  -v ht-rmt-data:/app/data \
  -v ht-rmt-logs:/app/logs \
  -e NODE_ENV=production \
  -e JWT_SECRET='your-secret-key' \
  -e REDIS_URL='redis://redis:6379' \
  -e REDIS_ENABLED='true' \
  ht-rmt:0.3.0

# 查看日志
docker logs -f ht-rmt

# 停止容器
docker stop ht-rmt
```

#### 3.4 Docker Compose 编排

**文件**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  # Redis 服务
  redis:
    image: redis:7-alpine
    container_name: ht-rmt-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  # HT-RMT 应用
  app:
    build: .
    container_name: ht-rmt-app
    depends_on:
      redis:
        condition: service_healthy
    ports:
      - "3000:3000"
      - "5353:5353/udp"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      NODE_ENV: production
      PORT: 3000
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
      DATABASE_PATH: /app/data/platform.db
      REDIS_ENABLED: 'true'
      REDIS_URL: redis://redis:6379
      MULTIENANT_ENABLED: 'true'
      DEVICE_DISCOVERY_ENABLED: 'true'
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

volumes:
  redis-data:

networks:
  default:
    name: ht-rmt-network
```

**启动 Docker Compose**:

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down

# 清理卷数据
docker-compose down -v
```

---

### 方案四: 集群模式部署（高可用）

适用于: 大规模、高并发生产环境

#### 4.1 架构图

```
负载均衡器 (Nginx / HAProxy)
         ↓
  ┌─────────────────────┐
  │  App Instance 1     │
  │   (Cluster Worker)  │
  └─────────────────────┘
  ┌─────────────────────┐
  │  App Instance 2     │
  │   (Cluster Worker)  │
  └─────────────────────┘
  ┌─────────────────────┐
  │  App Instance N     │
  │   (Cluster Worker)  │
  └─────────────────────┘
           ↓
      ┌─────────────────────┐
      │  Redis (Session)    │
      │  Shared Store       │
      └─────────────────────┘
           ↓
      ┌─────────────────────┐
      │  SQLite Database    │
      │  或外部数据库       │
      └─────────────────────┘
```

#### 4.2 Nginx 反向代理配置

**文件**: `/etc/nginx/sites-available/ht-rmt`

```nginx
upstream ht_rmt_backend {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
    keepalive 32;
}

server {
    listen 80;
    server_name ht-rmt.example.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ht-rmt.example.com;

    # SSL 证书
    ssl_certificate /etc/ssl/certs/ht-rmt.crt;
    ssl_certificate_key /etc/ssl/private/ht-rmt.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # 日志
    access_log /var/log/nginx/ht-rmt-access.log;
    error_log /var/log/nginx/ht-rmt-error.log;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://ht_rmt_backend;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    # API 代理
    location /api/ {
        proxy_pass http://ht_rmt_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # 所有其他请求
    location / {
        proxy_pass http://ht_rmt_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**启用配置**:

```bash
# 测试配置
sudo nginx -t

# 启用站点
sudo ln -s /etc/nginx/sites-available/ht-rmt /etc/nginx/sites-enabled/

# 重启 Nginx
sudo systemctl restart nginx
```

#### 4.3 集群启动脚本

**文件**: `scripts/start-cluster.sh`

```bash
#!/bin/bash

# 集群启动脚本
# 用法: ./scripts/start-cluster.sh [实例数]

INSTANCES=${1:-4}
BASE_PORT=3000

echo "启动 HT-RMT 集群（$INSTANCES 个实例）..."

for i in $(seq 0 $((INSTANCES-1))); do
    PORT=$((BASE_PORT + i))
    echo "启动实例 $i，端口 $PORT"
    PORT=$PORT npm start &
    sleep 2
done

echo "集群启动完成！"
echo "负载均衡器应指向以下地址："
for i in $(seq 0 $((INSTANCES-1))); do
    PORT=$((BASE_PORT + i))
    echo "  - http://127.0.0.1:$PORT"
done
```

**使用**:

```bash
chmod +x scripts/start-cluster.sh
./scripts/start-cluster.sh 4  # 启动 4 个实例
```

---

## 运维指南

### 备份与恢复

#### 数据库备份

```bash
# 完整备份
sqlite3 /var/lib/ht-rmt/platform.db ".backup backup_$(date +%Y%m%d_%H%M%S).db"

# 备份到其他位置
cp /var/lib/ht-rmt/platform.db /backup/platform_$(date +%Y%m%d_%H%M%S).db

# 自动每日备份（Cron）
0 2 * * * cp /var/lib/ht-rmt/platform.db /backup/platform_$(date +\%Y\%m\%d).db
```

#### 数据恢复

```bash
# 停止应用
pm2 stop ht-rmt

# 恢复备份
cp /backup/platform_20260505.db /var/lib/ht-rmt/platform.db

# 启动应用
pm2 start ht-rmt
```

### 日志管理

#### 日志位置

| 日志类型 | 位置 |
|---------|------|
| 应用日志 | `/var/log/ht-rmt/output.log` |
| 错误日志 | `/var/log/ht-rmt/error.log` |
| Systemd 日志 | `journalctl -u ht-rmt` |

#### 日志轮转（Logrotate）

**文件**: `/etc/logrotate.d/ht-rmt`

```
/var/log/ht-rmt/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 ht-rmt ht-rmt
    sharedscripts
    postrotate
        systemctl reload ht-rmt > /dev/null 2>&1 || true
    endscript
}
```

### 监控与告警

#### 使用 PM2 Monitor

```bash
# 启用 PM2 Plus 监控（需账户）
pm2 plus

# 基本监控
pm2 monit
```

#### 使用 Prometheus + Grafana（高级）

创建指标导出端点供 Prometheus 收集。

#### 健康检查脚本

**文件**: `scripts/health-check.sh`

```bash
#!/bin/bash

# 检查应用是否在运行
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)

if [ "$response" -eq 200 ]; then
    echo "✓ 应用健康"
    exit 0
else
    echo "✗ 应用故障 (HTTP $response)"
    exit 1
fi
```

### 性能优化

#### 1. 开启 Redis 缓存

```json
{
  "redis": {
    "enabled": true,
    "url": "redis://127.0.0.1:6379",
    "sessionStorage": true
  }
}
```

#### 2. 启用集群模式

```json
{
  "clustering": {
    "enabled": true,
    "numWorkers": 4
  }
}
```

#### 3. 数据库优化

```bash
# 分析表
sqlite3 /var/lib/ht-rmt/platform.db "ANALYZE"

# 重建索引
sqlite3 /var/lib/ht-rmt/platform.db "REINDEX"

# 优化表
sqlite3 /var/lib/ht-rmt/platform.db "VACUUM"
```

#### 4. Nginx 缓存优化

已在 Nginx 配置中配置了资源缓存。

---

## API 文档

### 认证接口

#### 用户注册

```http
POST /api/register
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123"
}
```

**响应**:
```json
{
  "success": true,
  "message": "User registered successfully"
}
```

#### 用户登录

```http
POST /api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**响应**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

#### 获取个人信息

```http
GET /api/profile
Authorization: Bearer {token}
```

**响应**:
```json
{
  "id": 1,
  "username": "admin",
  "role": "admin",
  "created_at": "2026-05-05T10:00:00Z"
}
```

#### 退出登录

```http
POST /api/logout
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 内容接口

#### 获取 IP 列表

```http
GET /api/ips?page=1&limit=10&tenant_id=default
```

**响应**:
```json
[
  {
    "id": 1,
    "name": "音柱 1",
    "description": "示例音柱",
    "image": "/assets/ip1.jpg",
    "audio_tone": 5,
    "created_at": "2026-05-05T10:00:00Z"
  }
]
```

#### 添加收藏

```http
POST /api/favorites
Authorization: Bearer {token}
Content-Type: application/json

{
  "ip_id": 1
}
```

#### 获取收藏列表

```http
GET /api/favorites
Authorization: Bearer {token}
```

#### 删除收藏

```http
DELETE /api/favorites/{id}
Authorization: Bearer {token}
```

### 反馈接口

#### 提交反馈

```http
POST /api/feedback
Authorization: Bearer {token}
Content-Type: application/json

{
  "ip_id": 1,
  "message": "这个音柱声质很好！"
}
```

#### 获取反馈列表

```http
GET /api/feedback?ip_id=1
Authorization: Bearer {token}
```

### 设备接口

#### 获取设备列表

```http
GET /api/devices
Authorization: Bearer {token}
```

#### 注册设备

```http
POST /api/devices
Authorization: Bearer {token}
Content-Type: application/json

{
  "device_id": "device-001",
  "device_name": "会议室音柱",
  "device_type": "speaker"
}
```

---

## 常见问题

### Q1: 如何修改默认端口？

答: 修改 `config/default.json` 或设置环境变量：

```bash
export PORT=8080
npm start
```

### Q2: 如何启用 Redis 缓存？

答: 
1. 安装 Redis: `sudo apt-get install redis-server`
2. 启动 Redis: `redis-server`
3. 在配置中启用: 
```json
{
  "redis": {
    "enabled": true,
    "url": "redis://localhost:6379"
  }
}
```

### Q3: 如何使用 SQLite 以外的数据库？

答: 目前系统设计为 SQLite。如需其他数据库，需修改 `server.js` 中的数据库驱动。

### Q4: 如何设置 HTTPS？

答: 
1. 使用 Nginx 反向代理（推荐）
2. 使用 Let's Encrypt 获取免费证书
3. 参考"集群模式部署"中的 Nginx 配置

### Q5: 如何处理大量并发连接？

答:
1. 启用集群模式: `npm run cluster`
2. 使用 Nginx 负载均衡
3. 启用 Redis 缓存
4. 使用连接池

### Q6: 默认密码是什么？

答: 默认管理员账号为 `admin / admin123`。**生产环境必须修改！**

### Q7: 如何创建新用户？

答: 访问应用的注册页面，或通过 `/api/register` 端点。

### Q8: 多租户如何隔离数据？

答: 在 `config` 中配置 `multiTenant.isolation`，支持 `database` 和 `row` 级别隔离。

### Q9: 如何查看应用日志？

答:
```bash
# PM2 日志
pm2 logs ht-rmt

# Systemd 日志
journalctl -u ht-rmt -f

# 文件日志
tail -f /var/log/ht-rmt/output.log
```

### Q10: 性能瓶颈在哪里？

答: 
1. **数据库**: 添加索引，使用 SQLite 优化
2. **网络**: 使用 CDN，启用 Gzip
3. **应用**: 使用集群模式，启用缓存
4. **硬件**: 增加 CPU/内存

---

## 故障排查

### 问题 1: 应用无法启动

**症状**: `npm start` 报错

**排查步骤**:

```bash
# 1. 检查 Node.js 版本
node -v  # 应 >= 14.0.0

# 2. 检查依赖是否安装
npm list

# 3. 检查端口是否被占用
lsof -i :3000

# 4. 检查数据库路径权限
ls -l ./data/

# 5. 查看详细错误信息
NODE_DEBUG=* npm start
```

**解决方案**:

- 端口被占用: 修改 `PORT` 或杀死占用进程
- 权限问题: `chmod 755 ./data/`
- 依赖缺失: `npm install`

### 问题 2: 登录失败

**症状**: 输入凭证后登录失败

**排查步骤**:

```bash
# 1. 检查数据库中是否有用户
sqlite3 ./data/platform.db "SELECT * FROM users"

# 2. 重新创建默认用户
# 查看 server.js 初始化代码

# 3. 检查 JWT_SECRET 是否一致
echo $JWT_SECRET

# 4. 查看浏览器控制台错误
# F12 → Console 标签
```

### 问题 3: Redis 连接失败

**症状**: Redis 相关错误

**排查步骤**:

```bash
# 1. 检查 Redis 是否运行
ps aux | grep redis

# 2. 测试连接
redis-cli ping

# 3. 检查 Redis URL 配置
cat config/default.json | grep redis

# 4. 检查防火墙
sudo ufw status
```

**解决方案**:

```bash
# 启动 Redis
redis-server --daemonize yes

# 或使用 Docker
docker run -d -p 6379:6379 redis:latest
```

### 问题 4: 磁盘空间不足

**症状**: 数据库写入失败，日志填满

**解查步骤**:

```bash
# 1. 检查磁盘使用
df -h

# 2. 检查日志大小
du -sh /var/log/ht-rmt/

# 3. 检查数据库大小
du -sh ./data/platform.db
```

**解决方案**:

```bash
# 清理旧日志
rm /var/log/ht-rmt/output.log.*

# 压缩数据库
sqlite3 ./data/platform.db "VACUUM"

# 增加磁盘空间
# 参考系统管理员
```

### 问题 5: DeviceDiscovery 不工作

**症状**: 设备无法自动发现

**排查步骤**:

```bash
# 1. 检查 mDNS 端口
netstat -un | grep 5353

# 2. 检查防火墙
sudo ufw allow 5353/udp

# 3. 检查网络连接
ping -c 4 <device-ip>
```

**解决方案**:

```bash
# 检查配置
cat config/default.json | grep deviceDiscovery

# 手动启动发现服务
npm run device-discovery
```

### 问题 6: 内存泄漏

**症状**: 内存占用不断增加

**排查步骤**:

```bash
# 1. 监控内存
pm2 monit

# 2. 检查数据库连接
sqlite3 ./data/platform.db "PRAGMA integrity_check"

# 3. 检查日志大小
du -sh logs/
```

**解决方案**:

```bash
# 重启应用
pm2 restart ht-rmt

# 分析堆快照（高级）
node --inspect server.js
# 访问 chrome://inspect
```

### 问题 7: 数据库锁定

**症状**: 数据库操作超时，提示 "database is locked"

**排查步骤**:

```bash
# 1. 检查未关闭的连接
lsof ./data/platform.db

# 2. 检查正在运行的查询
sqlite3 ./data/platform.db ".open" > /dev/null 2>&1 && echo "OK" || echo "LOCKED"
```

**解决方案**:

```bash
# 重启应用释放锁
pm2 restart ht-rmt

# 恢复数据库
sqlite3 ./data/platform.db "PRAGMA integrity_check; REINDEX;"
```

---

## 总结

本指南覆盖了 HT-RMT IP 音柱平台的完整部署和运维流程：

| 阶段 | 推荐方案 |
|------|---------|
| **开发** | 方案一：本地开发部署 |
| **小型生产** | 方案二：单机部署 (Systemd/PM2) |
| **中型生产** | 方案二：单机部署 (PM2) + Nginx |
| **大型生产** | 方案四：集群部署 + 负载均衡 + Redis |
| **云平台** | 方案三：Docker Compose 或 K8s |

根据业务规模选择合适的部署方案，定期备份数据，监控应用状态，定期维护系统。

---

**更新日期**: 2026-05-05  
**维护者**: HT-RMT Team  
**许可证**: MIT
