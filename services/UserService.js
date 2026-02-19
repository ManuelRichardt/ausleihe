const { Op } = require('sequelize');
const { pickDefined, buildListOptions, findByPkOrThrow, applyIncludeDeleted } = require('./serviceUtils');
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

  buildCaseInsensitiveEq(column, value) {
    const { sequelize } = this.models;
    return sequelize.where(sequelize.fn('LOWER', sequelize.col(column)), {
      [Op.eq]: String(value).toLowerCase(),
    });
  }

  buildCaseInsensitiveLike(column, value) {
    const { sequelize } = this.models;
    return sequelize.where(sequelize.fn('LOWER', sequelize.col(column)), {
      [Op.like]: `%${String(value).toLowerCase()}%`,
    });
  }

  resolveExternalProviderFilter(externalProvider) {
    if (!externalProvider) {
      return undefined;
    }
    if (externalProvider === 'local') {
      return null;
    }
    return externalProvider;
  }

  normalizeDateRangeInput({ from, to, inclusiveEndOfDay = true } = {}) {
    const range = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        range[Op.gte] = fromDate;
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        if (inclusiveEndOfDay) {
          toDate.setHours(23, 59, 59, 999);
        }
        range[Op.lte] = toDate;
      }
    }
    return range;
  }

  buildUserWhere(filter = {}) {
    const where = {};
    const andParts = [];
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
    if (filter.query) {
      // Query mode (q) intentionally overrides field-specific exact filters.
      andParts.push({
        [Op.or]: [
          this.buildCaseInsensitiveLike('username', filter.query),
          this.buildCaseInsensitiveLike('email', filter.query),
          this.buildCaseInsensitiveLike('first_name', filter.query),
          this.buildCaseInsensitiveLike('last_name', filter.query),
        ],
      });
    } else {
      if (filter.username) {
        andParts.push(this.buildCaseInsensitiveEq('username', filter.username));
      }
      if (filter.email) {
        andParts.push(this.buildCaseInsensitiveEq('email', filter.email));
      }
      if (filter.firstName) {
        andParts.push(this.buildCaseInsensitiveEq('first_name', filter.firstName));
      }
      if (filter.lastName) {
        andParts.push(this.buildCaseInsensitiveEq('last_name', filter.lastName));
      }
    }
    const externalProviderFilterValue = this.resolveExternalProviderFilter(filter.externalProvider);
    if (externalProviderFilterValue !== undefined) {
      where.externalProvider = externalProviderFilterValue;
    }
    if (filter.externalId) {
      andParts.push(this.buildCaseInsensitiveLike('external_id', filter.externalId));
    }
    const lastLoginAtRange = this.normalizeDateRangeInput({
      from: filter.lastLoginAtFrom,
      to: filter.lastLoginAtTo,
      inclusiveEndOfDay: true,
    });
    if (Object.keys(lastLoginAtRange).length) {
      andParts.push({ lastLoginAt: lastLoginAtRange });
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

  normalizeRoleAssignmentCommand(roleAssignmentCommand, actorContext) {
    if (roleAssignmentCommand && roleAssignmentCommand.assignment) {
      return {
        assignment: roleAssignmentCommand.assignment,
        actorContext: roleAssignmentCommand.actorContext || {},
      };
    }
    return {
      assignment: roleAssignmentCommand || {},
      actorContext: actorContext || {},
    };
  }

  resolveAuditActorId(actorContext, data) {
    return (actorContext && actorContext.actorId) || data.userId;
  }

  buildRoleAuditMetadata(data, extra = {}) {
    return {
      targetUserId: data.userId,
      roleId: data.roleId,
      lendingLocationId: data.lendingLocationId || null,
      ...extra,
    };
  }

  async assignRole(roleAssignmentCommand, actorContext) {
    const command = this.normalizeRoleAssignmentCommand(roleAssignmentCommand, actorContext);
    const data = command.assignment;
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
          userId: this.resolveAuditActorId(command.actorContext, data),
          action: 'role.assign',
          entity: 'UserRole',
          entityId: created.id,
          metadata: this.buildRoleAuditMetadata(data),
        },
        { transaction }
      );
      return created;
    });
  }

  async revokeRole(roleAssignmentCommand, actorContext) {
    const command = this.normalizeRoleAssignmentCommand(roleAssignmentCommand, actorContext);
    const data = command.assignment;
    const { UserRole } = this.models;
    const existing = await UserRole.findOne({
      where: this.resolveUserRoleKey(data),
    });
    if (!existing) {
      throw new Error('UserRole not found');
    }
    await existing.destroy();
    await this.models.AuditLog.create({
      userId: this.resolveAuditActorId(command.actorContext, data),
      action: 'role.revoke',
      entity: 'UserRole',
      entityId: existing.id,
      metadata: this.buildRoleAuditMetadata(data),
    });
    return true;
  }

  async revokeRoleEverywhere(roleAssignmentCommand, actorContext) {
    const command = this.normalizeRoleAssignmentCommand(roleAssignmentCommand, actorContext);
    const data = command.assignment;
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
          userId: this.resolveAuditActorId(command.actorContext, data),
          action: 'role.revoke_all',
          entity: 'UserRole',
          entityId: data.roleId,
          metadata: this.buildRoleAuditMetadata(data, { count: roles.length }),
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
