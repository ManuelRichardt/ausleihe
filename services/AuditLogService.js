const crypto = require('crypto');
const { buildListOptions, findByPkOrThrow } = require('./_serviceUtils');

class AuditLogService {
  constructor(models) {
    this.models = models;
  }

  async logAction(data) {
    return this.models.AuditLog.create({
      userId: data.userId || null,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId || data.userId || crypto.randomUUID(),
      metadata: data.metadata || null,
    });
  }

  async deleteLog(id) {
    const log = await findByPkOrThrow(this.models.AuditLog, id, 'AuditLog not found');
    await log.destroy();
    return true;
  }

  async getById(id) {
    return findByPkOrThrow(this.models.AuditLog, id, 'AuditLog not found');
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    if (filter.userId) {
      where.userId = filter.userId;
    }
    if (filter.entity) {
      where.entity = filter.entity;
    }
    if (filter.entityId) {
      where.entityId = filter.entityId;
    }
    return this.models.AuditLog.findAll({ where, ...buildListOptions(options) });
  }
}

module.exports = AuditLogService;
