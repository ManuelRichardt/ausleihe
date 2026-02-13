const { Op } = require('sequelize');
const { getLdapConfig } = require('../config/ldap');

class LdapProvisioningService {
  constructor(models) {
    this.models = models;
  }

  splitDisplayName(displayName) {
    if (!displayName) {
      return { firstName: null, lastName: null };
    }
    const parts = String(displayName).trim().split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: null };
    }
    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: parts[parts.length - 1],
    };
  }

  async findRoleByName(name) {
    if (!name) {
      return null;
    }
    return this.models.Role.findOne({
      where: {
        name: {
          [Op.like]: name,
        },
      },
    });
  }

  async assignRole(userId, role) {
    if (!role) {
      return;
    }
    if (role.scope === 'ausleihe') {
      return;
    }
    await this.models.UserRole.findOrCreate({
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
    });
  }

  async provision(normalizedProfile) {
    if (!normalizedProfile || !normalizedProfile.externalId) {
      throw new Error('LDAP profile missing externalId');
    }
    const { provider, config } = await getLdapConfig();
    const cfg = config || {};
    const { User } = this.models;

    let user = await User.findOne({
      where: {
        externalProvider: 'ldap',
        externalId: normalizedProfile.externalId,
      },
      paranoid: false,
    });
    if (!user && normalizedProfile.email) {
      user = await User.findOne({
        where: { email: normalizedProfile.email },
        paranoid: false,
      });
    }
    if (!user && normalizedProfile.username) {
      user = await User.findOne({
        where: { username: normalizedProfile.username },
        paranoid: false,
      });
    }

    const nameParts = this.splitDisplayName(normalizedProfile.displayName);
    const resolvedFirstName = normalizedProfile.firstName || nameParts.firstName;
    const resolvedLastName = normalizedProfile.lastName || nameParts.lastName;
    const payload = {
      username: normalizedProfile.username || normalizedProfile.email || normalizedProfile.externalId,
      email: normalizedProfile.email || null,
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      externalProvider: 'ldap',
      externalId: normalizedProfile.externalId,
      isActive: true,
      lastLoginAt: new Date(),
    };

    if (!user) {
      user = await User.create({
        ...payload,
        password: null,
      });
    } else {
      if (user.deletedAt) {
        await User.restore({ where: { id: user.id } });
      }
      await user.update(payload);
    }

    const roleMap = cfg.roleMapJson && typeof cfg.roleMapJson === 'object' ? cfg.roleMapJson : {};
    const groupRoles = [];
    if (Array.isArray(normalizedProfile.groups)) {
      normalizedProfile.groups.forEach((group) => {
        if (roleMap[group]) {
          groupRoles.push(roleMap[group]);
        }
      });
    }

    const roleNames = new Set(groupRoles.filter(Boolean));
    if (cfg.defaultRole) {
      roleNames.add(cfg.defaultRole);
    }
    if (!cfg.defaultRole && roleNames.size === 0) {
      roleNames.add('Students');
    }

    for (const roleName of roleNames) {
      const role = await this.findRoleByName(roleName);
      await this.assignRole(user.id, role);
    }

    return user;
  }
}

module.exports = LdapProvisioningService;
