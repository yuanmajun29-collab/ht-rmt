const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');

class TenantManager {
  constructor(db) {
    this.db = db;
    this.initTenantTables();
  }

  initTenantTables() {
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        owner_id INTEGER,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS tenant_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, key),
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      )
    `).run();

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS tenant_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, user_id),
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      )
    `).run();

    const defaultTenant = this.db.prepare('SELECT id FROM tenants WHERE id = ?').get(config.get('multiTenant.defaultTenant'));
    if (!defaultTenant) {
      this.createTenant(
        config.get('multiTenant.defaultTenant'),
        'Default Tenant',
        'Platform default tenant'
      );
    }
  }

  createTenant(tenantId, name, description = '') {
    try {
      const id = tenantId || uuidv4();
      this.db.prepare(`
        INSERT INTO tenants (id, name, description)
        VALUES (?, ?, ?)
      `).run(id, name, description);
      return { id, name, description };
    } catch (err) {
      throw new Error(`创建租户失败: ${err.message}`);
    }
  }

  getTenant(tenantId) {
    return this.db.prepare('SELECT * FROM tenants WHERE id = ? AND status = ?').get(tenantId, 'active');
  }

  getAllTenants() {
    return this.db.prepare('SELECT * FROM tenants WHERE status = ? ORDER BY created_at DESC').all('active');
  }

  updateTenantSetting(tenantId, key, value) {
    if (!this.getTenant(tenantId)) {
      throw new Error('租户不存在');
    }
    this.db.prepare(`
      INSERT INTO tenant_settings (tenant_id, key, value)
      VALUES (?, ?, ?)
      ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value
    `).run(tenantId, key, value);
  }

  getTenantSetting(tenantId, key, defaultValue = null) {
    const result = this.db.prepare(`
      SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = ?
    `).get(tenantId, key);
    return result?.value ?? defaultValue;
  }

  addTenantMember(tenantId, userId, role = 'member') {
    if (!this.getTenant(tenantId)) {
      throw new Error('租户不存在');
    }
    this.db.prepare(`
      INSERT INTO tenant_members (tenant_id, user_id, role)
      VALUES (?, ?, ?)
    `).run(tenantId, userId, role);
  }

  getTenantMembers(tenantId) {
    return this.db.prepare(`
      SELECT tm.*, u.username FROM tenant_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.tenant_id = ?
      ORDER BY tm.joined_at DESC
    `).all(tenantId);
  }

  iUserInTenant(userId, tenantId) {
    return !!this.db.prepare(`
      SELECT 1 FROM tenant_members WHERE user_id = ? AND tenant_id = ?
    `).get(userId, tenantId);
  }

  getTenantForUser(userId) {
    const result = this.db.prepare(`
      SELECT t.* FROM tenants t
      JOIN tenant_members tm ON t.id = tm.tenant_id
      WHERE tm.user_id = ? AND t.status = ?
      ORDER BY tm.joined_at ASC LIMIT 1
    `).get(userId, 'active');
    return result || this.getTenant(config.get('multiTenant.defaultTenant'));
  }

  deleteTenant(tenantId) {
    if (tenantId === config.get('multiTenant.defaultTenant')) {
      throw new Error('无法删除默认租户');
    }
    this.db.prepare('UPDATE tenants SET status = ? WHERE id = ?').run('deleted', tenantId);
  }
}

module.exports = TenantManager;
