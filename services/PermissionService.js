const { Op } = require('sequelize');
const { pickDefined, buildListOptions, findByPkOrThrow } = require('./_serviceUtils');

class PermissionService {
  constructor(models) {
    this.models = models;
  }

  buildPermissionWhere(filter = {}) {
    const { sequelize } = this.models;
    const where = {};
    if (filter.query) {
      const likeValue = `%${String(filter.query).toLowerCase()}%`;
      where[Op.or] = [
        sequelize.where(sequelize.fn('LOWER', sequelize.col('key')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('description')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('scope')), { [Op.like]: likeValue }),
      ];
    } else {
      if (filter.key) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push(
          sequelize.where(sequelize.fn('LOWER', sequelize.col('key')), {
            [Op.eq]: String(filter.key).toLowerCase(),
          })
        );
      }
      if (filter.scope) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push(
          sequelize.where(sequelize.fn('LOWER', sequelize.col('scope')), {
            [Op.eq]: String(filter.scope).toLowerCase(),
          })
        );
      }
      if (filter.description) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push(
          sequelize.where(sequelize.fn('LOWER', sequelize.col('description')), {
            [Op.eq]: String(filter.description).toLowerCase(),
          })
        );
      }
    }
    return where;
  }

  buildCreatePermissionPayload(data) {
    return {
      key: data.key,
      description: data.description || null,
      scope: data.scope || 'global',
    };
  }

  async createPermission(data, meta = {}) {
    const payload = this.buildCreatePermissionPayload(data);
    const permission = await this.models.Permission.create(payload);
    await this.#logPermissionEvent(meta.actorId, 'permission.create', permission.id, {
      key: permission.key,
      scope: permission.scope,
    });
    return permission;
  }

  async getById(id) {
    return findByPkOrThrow(this.models.Permission, id, 'Permission not found');
  }

  async getByKey(key) {
    const permission = await this.models.Permission.findOne({ where: { key } });
    if (!permission) {
      throw new Error('Permission not found');
    }
    return permission;
  }

  async getAll(options = {}) {
    return this.models.Permission.findAll({ ...buildListOptions(options) });
  }

  async searchPermissions(filter = {}, options = {}) {
    const where = this.buildPermissionWhere(filter);
    return this.models.Permission.findAll({ where, ...buildListOptions(options) });
  }

  async countPermissions(filter = {}) {
    const where = this.buildPermissionWhere(filter);
    return this.models.Permission.count({ where });
  }

  async updatePermission(id, updates, meta = {}) {
    const permission = await this.getById(id);
    const allowedUpdates = pickDefined(updates, ['key', 'description', 'scope']);
    await permission.update(allowedUpdates);
    await this.#logPermissionEvent(meta.actorId, 'permission.update', permission.id, {
      key: permission.key,
      scope: permission.scope,
    });
    return permission;
  }

  async deletePermission(id, meta = {}) {
    const permission = await this.getById(id);
    await permission.destroy();
    await this.#logPermissionEvent(meta.actorId, 'permission.delete', id, {
      key: permission.key,
    });
    return true;
  }

  async #logPermissionEvent(actorId, action, permissionId, metadata) {
    if (!actorId) {
      return null;
    }
    return this.models.AuditLog.create({
      userId: actorId,
      action,
      entity: 'Permission',
      entityId: permissionId,
      metadata: metadata || null,
    });
  }
}

module.exports = PermissionService;
