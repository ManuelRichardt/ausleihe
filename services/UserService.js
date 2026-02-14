const { Op } = require('sequelize');
const { pickDefined, buildListOptions, findByPkOrThrow, applyIncludeDeleted } = require('./_serviceUtils');
const { validatePasswordPolicy } = require('../utils/passwordPolicy');

const permissionInclude = {
  model: null,
  as: 'permissions',
  through: { model: null, attributes: [] },
};

const userWithRolesIncludes = {
  model: null,
  as: 'userRoles',
  include: [],
};

class UserService {
  constructor(models) {
    this.models = models;
  }

  buildUserWhere(filter = {}) {
    const { sequelize } = this.models;
    const where = {};
    const andParts = [];
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
    if (filter.query) {
      const likeValue = `%${String(filter.query).toLowerCase()}%`;
      andParts.push({
        [Op.or]: [
        sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('first_name')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('last_name')), { [Op.like]: likeValue }),
        ],
      });
    } else {
      if (filter.username) {
        andParts.push(
          sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), {
            [Op.eq]: String(filter.username).toLowerCase(),
          })
        );
      }
      if (filter.email) {
        andParts.push(
          sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), {
            [Op.eq]: String(filter.email).toLowerCase(),
          })
        );
      }
      if (filter.firstName) {
        andParts.push(
          sequelize.where(sequelize.fn('LOWER', sequelize.col('first_name')), {
            [Op.eq]: String(filter.firstName).toLowerCase(),
          })
        );
      }
      if (filter.lastName) {
        andParts.push(
          sequelize.where(sequelize.fn('LOWER', sequelize.col('last_name')), {
            [Op.eq]: String(filter.lastName).toLowerCase(),
          })
        );
      }
    }
    if (filter.externalProvider) {
      if (filter.externalProvider === 'local') {
        where.externalProvider = null;
      } else {
        where.externalProvider = filter.externalProvider;
      }
    }
    if (filter.externalId) {
      andParts.push(
        sequelize.where(sequelize.fn('LOWER', sequelize.col('external_id')), {
          [Op.like]: `%${String(filter.externalId).toLowerCase()}%`,
        })
      );
    }
    if (filter.lastLoginAtFrom || filter.lastLoginAtTo) {
      const range = {};
      if (filter.lastLoginAtFrom) {
        const fromDate = new Date(filter.lastLoginAtFrom);
        if (!Number.isNaN(fromDate.getTime())) {
          range[Op.gte] = fromDate;
        }
      }
      if (filter.lastLoginAtTo) {
        const toDate = new Date(filter.lastLoginAtTo);
        if (!Number.isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          range[Op.lte] = toDate;
        }
      }
      if (Object.keys(range).length) {
        andParts.push({ lastLoginAt: range });
      }
    }
    if (andParts.length) {
      where[Op.and] = andParts;
    }
    return where;
  }

  buildCreateUserPayload(data) {
    return {
      username: data.username,
      email: data.email,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      password: data.password || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };
  }

  resolveUserQuery(options) {
    // withPassword scope includes hashed password for auth flows
    const scope = options && options.withPassword ? 'withPassword' : null;
    if (!scope) {
      return this.models.User;
    }
    return this.models.User.scope(scope);
  }

  async loadUserWithPassword(id) {
    const query = this.resolveUserQuery({ withPassword: true });
    return findByPkOrThrow(query, id, 'User not found');
  }

  async createUser(data) {
    const payload = this.buildCreateUserPayload(data);
    if (payload.password) {
      validatePasswordPolicy(payload.password);
    }
    const { sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const user = await this.models.User.create(payload, { transaction });
      await this.ensureStudentRole(user.id, transaction);
      return user;
    });
  }

  async getById(id, options = {}) {
    const userQuery = this.resolveUserQuery(options);
    const findOptions = {};
    if (options.includeDeleted) {
      findOptions.paranoid = false;
    }
    return findByPkOrThrow(userQuery, id, 'User not found', findOptions);
  }

  async getByUsername(username, options = {}) {
    const userQuery = this.resolveUserQuery(options);
    const user = await userQuery.findOne({ where: { username } });
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async findByUsername(username, options = {}) {
    const { sequelize } = this.models;
    const userQuery = this.resolveUserQuery(options);
    const where = {
      [Op.and]: [
        sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), {
          [Op.eq]: String(username || '').toLowerCase(),
        }),
      ],
    };
    const findOptions = { where };
    if (options.includeDeleted) {
      findOptions.paranoid = false;
    }
    return userQuery.findOne(findOptions);
  }

  async searchUsers(filter = {}, options = {}) {
    const where = this.buildUserWhere(filter);
    const listOptions = buildListOptions(options);
    applyIncludeDeleted(listOptions, filter);
    return this.models.User.findAll({ where, ...listOptions });
  }

  async getAll(filter = {}, options = {}) {
    const { User, UserRole, Role, Permission, RolePermission, LendingLocation } = this.models;
    const where = this.buildUserWhere(filter);
    const listOptions = buildListOptions(options);
    applyIncludeDeleted(listOptions, filter);
    const permissionIncludeResolved = {
      ...permissionInclude,
      model: Permission,
      through: { ...permissionInclude.through, model: RolePermission },
    };
    const userRolesIncludesResolved = {
      ...userWithRolesIncludes,
      model: UserRole,
      include: [
        {
          model: Role,
          as: 'role',
          include: [permissionIncludeResolved],
        },
        { model: LendingLocation, as: 'lendingLocation' },
      ],
    };
    // Intentionally eager-load roles/permissions for authorization screens
    return User.findAll({
      where,
      ...listOptions,
      include: [
        userRolesIncludesResolved,
        {
          model: Role,
          as: 'roles',
          include: [permissionIncludeResolved],
        },
      ],
    });
  }

  async countUsers(filter = {}) {
    const { User } = this.models;
    const where = this.buildUserWhere(filter);
    const countOptions = {};
    if (filter.includeDeleted) {
      countOptions.paranoid = false;
    }
    return User.count({ where, ...countOptions });
  }

  async updateUser(id, updates) {
    const user = await this.loadUserWithPassword(id);
    const allowedUpdates = pickDefined(updates, ['username', 'email', 'firstName', 'lastName', 'isActive']);
    await user.update(allowedUpdates);
    return this.getById(id);
  }

  async setPassword(id, plainPassword) {
    const user = await this.loadUserWithPassword(id);
    // Null password disables local auth for this user
    if (plainPassword) {
      validatePasswordPolicy(plainPassword);
    }
    await user.update({ password: plainPassword || null });
    return this.getById(id);
  }

  async setActive(id, nextIsActive) {
    if (nextIsActive === undefined) {
      throw new Error('nextIsActive is required');
    }
    const user = await this.getById(id);
    await user.update({ isActive: Boolean(nextIsActive) });
    return this.getById(id);
  }

  async ensureStudentRole(userId, transaction) {
    const { Role, UserRole } = this.models;
    const role = await Role.findOne({ where: { name: 'Students' }, transaction });
    if (!role) {
      return null;
    }
    if (role.scope === 'ausleihe') {
      return null;
    }
    await UserRole.findOrCreate({
      where: {
        userId,
        roleId: role.id,
        lendingLocationId: null,
      },
      defaults: {
        userId,
        roleId: role.id,
        lendingLocationId: null,
      },
      transaction,
    });
    return role;
  }

  async deleteUser(id) {
    const user = await this.getById(id);
    // Hard delete; consider soft delete if audit retention required
    await user.destroy();
    return true;
  }

  async restoreUser(id) {
    const restored = await this.models.User.restore({ where: { id } });
    if (!restored) {
      throw new Error('User not found');
    }
    return this.getById(id);
  }

  async assignRole(data, meta = {}) {
    const { sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      await this.validateRoleAssignment(data, transaction);
      const existing = await this.findExistingUserRole(data, transaction);
      if (existing) {
        return existing;
      }
      const created = await this.createUserRole(data, transaction);
      await this.models.AuditLog.create(
        {
          userId: meta.actorId || data.userId,
          action: 'role.assign',
          entity: 'UserRole',
          entityId: created.id,
          metadata: {
            targetUserId: data.userId,
            roleId: data.roleId,
            lendingLocationId: data.lendingLocationId || null,
          },
        },
        { transaction }
      );
      return created;
    });
  }

  async revokeRole(data, meta = {}) {
    const { UserRole } = this.models;
    const existing = await UserRole.findOne({
      where: this.resolveUserRoleKey(data),
    });
    if (!existing) {
      throw new Error('UserRole not found');
    }
    await existing.destroy();
    await this.models.AuditLog.create({
      userId: meta.actorId || data.userId,
      action: 'role.revoke',
      entity: 'UserRole',
      entityId: existing.id,
      metadata: {
        targetUserId: data.userId,
        roleId: data.roleId,
        lendingLocationId: data.lendingLocationId || null,
      },
    });
    return true;
  }

  async revokeRoleEverywhere(data, meta = {}) {
    const { sequelize, UserRole } = this.models;
    return sequelize.transaction(async (transaction) => {
      const roles = await UserRole.findAll({
        where: { userId: data.userId, roleId: data.roleId },
        transaction,
      });
      if (!roles.length) {
        throw new Error('UserRole not found');
      }
      await UserRole.destroy({
        where: { userId: data.userId, roleId: data.roleId },
        transaction,
      });
      await this.models.AuditLog.create(
        {
          userId: meta.actorId || data.userId,
          action: 'role.revoke_all',
          entity: 'UserRole',
          entityId: data.roleId,
          metadata: {
            targetUserId: data.userId,
            roleId: data.roleId,
            count: roles.length,
          },
        },
        { transaction }
      );
      return true;
    });
  }

  async listUserRoles(userId) {
    const { UserRole, Role, Permission, RolePermission, LendingLocation } = this.models;
    const permissionIncludeResolved = {
      ...permissionInclude,
      model: Permission,
      through: { ...permissionInclude.through, model: RolePermission },
    };
    const userRoleIncludes = [
      {
        model: Role,
        as: 'role',
        include: [permissionIncludeResolved],
      },
      { model: LendingLocation, as: 'lendingLocation' },
    ];
    return UserRole.findAll({
      where: { userId },
      include: userRoleIncludes,
    });
  }

  resolveUserRoleKey(data) {
    return {
      userId: data.userId,
      roleId: data.roleId,
      lendingLocationId: data.lendingLocationId || null,
    };
  }

  async validateRoleAssignment(data, transaction) {
    const { User, Role, LendingLocation } = this.models;
    const user = await User.findByPk(data.userId, { transaction });
    if (!user) {
      throw new Error('User not found');
    }
    const role = await Role.findByPk(data.roleId, { transaction });
    if (!role) {
      throw new Error('Role not found');
    }
    if (role.scope === 'ausleihe' && !data.lendingLocationId) {
      throw new Error('LendingLocation is required for ausleihe roles');
    }
    if (role.scope !== 'ausleihe' && data.lendingLocationId) {
      throw new Error('Global roles must not be assigned to a lending location');
    }
    if (data.lendingLocationId) {
      const location = await LendingLocation.findByPk(data.lendingLocationId, { transaction });
      if (!location) {
        throw new Error('LendingLocation not found');
      }
    }
  }

  async findExistingUserRole(data, transaction) {
    const { UserRole } = this.models;
    // Composite uniqueness: userId + roleId + lendingLocationId
    return UserRole.findOne({
      where: this.resolveUserRoleKey(data),
      transaction,
    });
  }

  async createUserRole(data, transaction) {
    const { UserRole } = this.models;
    return UserRole.create(this.resolveUserRoleKey(data), { transaction });
  }
}

module.exports = UserService;
