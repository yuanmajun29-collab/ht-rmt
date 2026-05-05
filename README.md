# HT-RMT IP 音柱平台

这是一个完整的 IP 音柱平台，支持以下功能：

- 用户注册 / 登录
- 音柱浏览与试听
- 收藏/取消收藏
- 播放记录与反馈提交
- 管理员 IP 管理面板
- 持久化存储到 SQLite 数据库

## 运行方式

1. 安装依赖

```bash
npm install
```

2. 启动服务

```bash
npm start
```

3. 打开浏览器访问

```text
http://localhost:3000
```

## 默认管理员账号

- 用户名：`admin`
- 密码：`admin123`

## 项目结构

- `server.js` - 后端服务入口
- `data/platform.db` - SQLite 数据库（运行时生成）
- `public/` - 前端页面、样式和逻辑
- `package.json` - 项目配置与依赖

## API 功能

- `POST /api/register` - 用户注册
- `POST /api/login` - 用户登录
- `POST /api/logout` - 退出登录
- `GET /api/profile` - 当前用户信息
- `GET /api/ips` - IP 音柱列表
- `POST /api/play` - 播放音柱并记录播放
- `POST /api/feedback` - 提交用户反馈
- `POST /api/favorites/:ipId` - 收藏/取消收藏
- `GET /api/favorites` - 当前用户收藏列表
- 管理员接口：`/api/admin/ips`

## 说明

页面会使用浏览器 Web Audio API 模拟音柱播放，用户登录后可保存收藏、提交反馈，并通过管理员界面管理 IP。