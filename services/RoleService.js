const { Op } = require('sequelize');
const { pickDefined, buildListOptions, findByPkOrThrow, applyIncludeDeleted } = require('./serviceUtils');

const permissionInclude = {
  model: null,
  as: 'permissions',
  through: { model: null, attributes: [] },
};

class RoleService {
  constructor(models) {
    this.models = models;
  }

  buildRoleWhere(filter = {}) {
    const { sequelize } = this.models;
    const where = {};
    if (filter.query) {
      const likeValue = `%${String(filter.query).toLowerCase()}%`;
      where[Op.or] = [
        sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('description')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('scope')), { [Op.like]: likeValue }),
      ];
    } else {
      if (filter.name) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push(
          sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), {
            [Op.eq]: String(filter.name).toLowerCase(),
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

  buildCreateRolePayload(data) {
    return {
      name: data.name,
      description: data.description || null,
      scope: data.scope || 'global',
    };
  }

  async createRole(data, meta = {}) {
    const payload = this.buildCreateRolePayload(data);
    const role = await this.models.Role.create(payload);
    await this.#logRoleEvent(meta.actorId, 'role.create', role.id, {
      name: role.name,
      scope: role.scope,
    });
    return role;
  }

  async getById(id, options = {}) {
    const findOptions = {};
    if (options.includeDeleted) {
      findOptions.paranoid = false;
    }
    return findByPkOrThrow(this.models.Role, id, 'Role not found', findOptions);
  }

  async getByIdWithPermissions(id) {
    const { Role, Permission, RolePermission } = this.models;
    const permissionIncludeResolved = {
      ...permissionInclude,
      model: Permission,
      through: { ...permissionInclude.through, model: RolePermission },
    };
    const role = await Role.findByPk(id, { include: [permissionIncludeResolved] });
    if (!role) {
      throw new Error('Role not found');
    }
    return role;
  }

  async getAll(options = {}) {
    const { Role, Permission, RolePermission } = this.models;
    const permissionIncludeResolved = {
      ...permissionInclude,
      model: Permission,
      through: { ...permissionInclude.through, model: RolePermission },
    };
    return Role.findAll({
      ...buildListOptions(options),
      include: [permissionIncludeResolved],
    });
  }

  async searchRoles(filter = {}, options = {}) {
    const where = this.buildRoleWhere(filter);
    const listOptions = buildListOptions(options);
    applyIncludeDeleted(listOptions, filter);
    return this.models.Role.findAll({ where, ...listOptions });
  }

  async countRoles(filter = {}) {
    const where = this.buildRoleWhere(filter);
    const countOptions = {};
    if (filter.includeDeleted) {
      countOptions.paranoid = false;
    }
    return this.models.Role.count({ where, ...countOptions });
  }

  async updateRole(id, updates, meta = {}) {
    const role = await this.getById(id);
    const allowedUpdates = pickDefined(updates, ['name', 'description', 'scope']);
    await role.update(allowedUpdates);
    await this.#logRoleEvent(meta.actorId, 'role.update', role.id, {
      name: role.name,
      scope: role.scope,
    });
    return role;
  }

  async addPermission(roleId, permissionId, meta = {}) {
    const { Role, Permission, RolePermission, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const role = await Role.findByPk(roleId, { transaction });
      if (!role) {
        throw new Error('Role not found');
      }
      const permission = await Permission.findByPk(permissionId, { transaction });
      if (!permission) {
        throw new Error('Permission not found');
      }
      const existing = await RolePermission.findOne({
        where: { roleId, permissionId },
        transaction,
      });
      if (existing) {
        return existing;
      }
      const created = await RolePermission.create({ roleId, permissionId }, { transaction });
      await this.#logRoleEvent(meta.actorId, 'role.permission.add', roleId, {
        permissionId,
      }, transaction);
      return created;
    });
  }

  async removePermission(roleId, permissionId, meta = {}) {
    const { RolePermission } = this.models;
    const deleted = await RolePermission.destroy({ where: { roleId, permissionId } });
    if (!deleted) {
      throw new Error('RolePermission not found');
    }
    await this.#logRoleEvent(meta.actorId, 'role.permission.remove', roleId, {
      permissionId,
    });
    return true;
  }

  async deleteRole(id, meta = {}) {
    const role = await this.getById(id);
    await role.destroy();
    await this.#logRoleEvent(meta.actorId, 'role.delete', id, {
      name: role.name,
    });
    return true;
  }

  async restoreRole(id, meta = {}) {
    const restored = await this.models.Role.restore({ where: { id } });
    if (!restored) {
      throw new Error('Role not found');
    }
    await this.#logRoleEvent(meta.actorId, 'role.restore', id);
    return this.getById(id);
  }

  async #logRoleEvent(actorId, action, roleId, metadata, transaction) {
    if (!actorId) {
      return null;
    }
    return this.models.AuditLog.create(
      {
        userId: actorId,
        action,
        entity: 'Role',
        entityId: roleId,
        metadata: metadata || null,
      },
      transaction ? { transaction } : undefined
    );
  }
}

module.exports = RoleService;
