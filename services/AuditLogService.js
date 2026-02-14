const crypto = require('crypto');
const { Op } = require('sequelize');
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
    if (filter.action) {
      where.action = filter.action;
    }
    if (filter.entity) {
      where.entity = filter.entity;
    }
    if (filter.entityId) {
      where.entityId = filter.entityId;
    }
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) {
        const from = new Date(filter.dateFrom);
        if (!Number.isNaN(from.getTime())) {
          where.createdAt[Op.gte] = from;
        }
      }
      if (filter.dateTo) {
        const to = new Date(filter.dateTo);
        if (!Number.isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          where.createdAt[Op.lte] = to;
        }
      }
      if (!Object.keys(where.createdAt).length) {
        delete where.createdAt;
      }
    }
    return this.models.AuditLog.findAll({
      where,
      include: [{ model: this.models.User, as: 'user' }],
      ...buildListOptions(options),
    });
  }

  async countLogs(filter = {}) {
    const where = {};
    if (filter.userId) {
      where.userId = filter.userId;
    }
    if (filter.action) {
      where.action = filter.action;
    }
    if (filter.entity) {
      where.entity = filter.entity;
    }
    if (filter.entityId) {
      where.entityId = filter.entityId;
    }
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) {
        const from = new Date(filter.dateFrom);
        if (!Number.isNaN(from.getTime())) {
          where.createdAt[Op.gte] = from;
        }
      }
      if (filter.dateTo) {
        const to = new Date(filter.dateTo);
        if (!Number.isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          where.createdAt[Op.lte] = to;
        }
      }
      if (!Object.keys(where.createdAt).length) {
        delete where.createdAt;
      }
    }
    return this.models.AuditLog.count({ where });
  }

  async distinctValues(field) {
    return this.models.AuditLog.findAll({
      attributes: [[field, 'value']],
      group: [field],
      order: [[field, 'ASC']],
      raw: true,
    });
  }
}

module.exports = AuditLogService;
