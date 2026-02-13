class SamlProvisioningService {
  constructor(models) {
    this.models = models;
  }

  normalizeProfile(extract) {
    const attributes = extract && extract.attributes ? extract.attributes : {};
    const nameId = extract && (extract.nameID || extract.nameId) ? (extract.nameID || extract.nameId) : null;
    const getAttr = (keys) => {
      for (const key of keys) {
        if (attributes[key]) {
          const value = attributes[key];
          if (Array.isArray(value)) {
            return value[0];
          }
          return value;
        }
      }
      return null;
    };

    const email =
      getAttr([
        'mail',
        'email',
        'urn:oid:0.9.2342.19200300.100.1.3',
      ]) || null;
    const username =
      getAttr([
        'uid',
        'eppn',
        'userPrincipalName',
        'urn:oid:0.9.2342.19200300.100.1.1',
      ]) || email || nameId || null;
    const displayName =
      getAttr([
        'displayName',
        'cn',
        'commonName',
        'urn:oid:2.5.4.3',
      ]) || username || '';

    const externalId = nameId || email || username || null;
    const groupsRaw = attributes.memberOf || attributes.groups || [];
    const groups = Array.isArray(groupsRaw) ? groupsRaw : groupsRaw ? [groupsRaw] : [];

    return {
      externalId,
      email,
      username,
      displayName,
      groups,
    };
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

  async ensureDefaultRole(userId) {
    const role = await this.models.Role.findOne({ where: { name: 'Students' } });
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
      throw new Error('SAML profile missing externalId');
    }
    const { User } = this.models;
    const existing = await User.findOne({
      where: {
        externalProvider: 'saml',
        externalId: normalizedProfile.externalId,
      },
      paranoid: false,
    });

    let user = existing;
    if (!user && normalizedProfile.email) {
      user = await User.findOne({
        where: {
          email: normalizedProfile.email,
        },
        paranoid: false,
      });
    }

    const nameParts = this.splitDisplayName(normalizedProfile.displayName);
    const payload = {
      username: normalizedProfile.username || normalizedProfile.email || normalizedProfile.externalId,
      email: normalizedProfile.email || normalizedProfile.username || null,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      externalProvider: 'saml',
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

    await this.ensureDefaultRole(user.id);
    return user;
  }
}

module.exports = SamlProvisioningService;
