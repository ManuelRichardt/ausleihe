const DEFAULT_PERMISSION_SCOPE = 'both';
const INSTALLATION_KEY = 'primary';

const permissionsSeed = [
  { key: 'admin.access', description: 'Zugriff auf Admin-Bereich (Ausleihe)', scope: 'ausleihe' },
  { key: 'system.admin', description: 'Systemweite Administration', scope: 'global' },
  { key: 'users.manage', description: 'Benutzer verwalten', scope: 'global' },
  { key: 'roles.manage', description: 'Rollen verwalten', scope: 'global' },
  { key: 'permissions.manage', description: 'Permissions verwalten', scope: 'global' },
  { key: 'customfields.manage', description: 'Custom Fields verwalten', scope: 'global' },
  { key: 'audit.view', description: 'Audit Log einsehen', scope: 'global' },
  { key: 'system.auth.manage', description: 'Auth Konfiguration verwalten', scope: 'global' },
  { key: 'lendinglocations.manage', description: 'Ausleihstellen bearbeiten (standortbezogen)', scope: 'ausleihe' },
  { key: 'loan.create', description: 'Reservierungen erstellen', scope: 'both' },
  { key: 'loan.manage', description: 'Ausleihen verwalten', scope: 'ausleihe' },
  { key: 'inventory.manage', description: 'Inventar verwalten', scope: 'ausleihe' },
  { key: 'openinghours.manage', description: 'Oeffnungszeiten verwalten', scope: 'ausleihe' },
];

class InstallationService {
  constructor(models) {
    this.models = models;
  }

  async run({
    adminUsername,
    adminEmail,
    adminPassword,
    adminFirstName,
    adminLastName,
  }) {
    const models = this.models;
    await models.sequelize.authenticate();
    await models.sequelize.sync();

    const existingInstallation = await models.Installation.findOne({
      where: { key: INSTALLATION_KEY },
    });
    if (existingInstallation) {
      throw new Error('Installation already completed');
    }

    await models.sequelize.transaction(async (transaction) => {
      const permissions = [];
      for (const perm of permissionsSeed) {
        const [record] = await models.Permission.findOrCreate({
          where: { key: perm.key },
          defaults: {
            key: perm.key,
            description: perm.description,
            scope: perm.scope || DEFAULT_PERMISSION_SCOPE,
          },
          transaction,
        });
        permissions.push(record);
      }

      const [superAdminRole] = await models.Role.findOrCreate({
        where: { name: 'Super Admin' },
        defaults: {
          name: 'Super Admin',
          description: 'Systemweite Administration (ohne Ausleihe-Rechte)',
          scope: 'global',
        },
        transaction,
      });

      const [locationAdminRole] = await models.Role.findOrCreate({
        where: { name: 'Admin', scope: 'ausleihe' },
        defaults: {
          name: 'Admin',
          description: 'Adminrechte innerhalb einer Ausleihe',
          scope: 'ausleihe',
        },
        transaction,
      });

      const [studentRole] = await models.Role.findOrCreate({
        where: { name: 'Students', scope: 'global' },
        defaults: {
          name: 'Students',
          description: 'Studierende mit Reservierungsrecht',
          scope: 'global',
        },
        transaction,
      });

      const [loanDeskRole] = await models.Role.findOrCreate({
        where: { name: 'Ausleihe Operator', scope: 'ausleihe' },
        defaults: {
          name: 'Ausleihe Operator',
          description: 'Ausgaben bearbeiten, übergeben und zurücknehmen',
          scope: 'ausleihe',
        },
        transaction,
      });

      const [inventoryManagerRole] = await models.Role.findOrCreate({
        where: { name: 'Inventarverwaltung', scope: 'ausleihe' },
        defaults: {
          name: 'Inventarverwaltung',
          description: 'Inventarverwaltung für Kategorien, Hersteller, Modelle und Assets',
          scope: 'ausleihe',
        },
        transaction,
      });

      const permissionMap = permissions.reduce((acc, perm) => {
        acc[perm.key] = perm;
        return acc;
      }, {});

      const superAdminKeys = [
        'system.admin',
        'users.manage',
        'roles.manage',
        'permissions.manage',
        'customfields.manage',
        'audit.view',
        'system.auth.manage',
      ];
      const locationAdminKeys = [
        'admin.access',
        'lendinglocations.manage',
        'loan.create',
        'loan.manage',
        'inventory.manage',
        'openinghours.manage',
      ];
      const studentKeys = ['loan.create'];
      const loanDeskKeys = ['admin.access', 'loan.manage'];
      const inventoryManagerKeys = ['admin.access', 'inventory.manage'];

      const superAdminRolePermissions = superAdminKeys
        .map((key) => permissionMap[key])
        .filter(Boolean)
        .map((permission) => ({
          roleId: superAdminRole.id,
          permissionId: permission.id,
        }));
      const locationAdminRolePermissions = locationAdminKeys
        .map((key) => permissionMap[key])
        .filter(Boolean)
        .map((permission) => ({
          roleId: locationAdminRole.id,
          permissionId: permission.id,
        }));
      const studentRolePermissions = studentKeys
        .map((key) => permissionMap[key])
        .filter(Boolean)
        .map((permission) => ({
          roleId: studentRole.id,
          permissionId: permission.id,
        }));
      const loanDeskRolePermissions = loanDeskKeys
        .map((key) => permissionMap[key])
        .filter(Boolean)
        .map((permission) => ({
          roleId: loanDeskRole.id,
          permissionId: permission.id,
        }));
      const inventoryManagerRolePermissions = inventoryManagerKeys
        .map((key) => permissionMap[key])
        .filter(Boolean)
        .map((permission) => ({
          roleId: inventoryManagerRole.id,
          permissionId: permission.id,
        }));

      await models.RolePermission.bulkCreate(
        [
          ...superAdminRolePermissions,
          ...locationAdminRolePermissions,
          ...studentRolePermissions,
          ...loanDeskRolePermissions,
          ...inventoryManagerRolePermissions,
        ],
        { transaction, ignoreDuplicates: true }
      );

      await models.AuthProviderConfig.findOrCreate({
        where: { provider: 'saml' },
        defaults: {
          provider: 'saml',
          enabled: false,
          displayName: 'Shibboleth',
          config: {
            spEntityId: '',
            acsUrl: '',
            sloUrl: '',
            idpEntityId: '',
            idpSsoUrl: '',
            idpSloUrl: '',
            nameIdFormat: '',
            clockSkewSec: 120,
          },
        },
        transaction,
      });

      await models.AuthProviderConfig.findOrCreate({
        where: { provider: 'ldap' },
        defaults: {
          provider: 'ldap',
          enabled: false,
          displayName: 'LDAP',
          config: {
            url: '',
            baseDn: '',
            bindDn: '',
            bindPassword: '',
            tlsRejectUnauthorized: true,
            userFilter: '(uid={{username}})',
            userDnTemplate: '',
            searchScope: 'sub',
            attrUsername: 'uid',
            attrEmail: 'mail',
            attrDisplayName: 'displayName',
            attrFirstName: 'givenName',
            attrLastName: 'sn',
            attrExternalId: 'entryUUID',
            attrGroups: 'memberOf',
            startTls: false,
            timeoutMs: 8000,
            connectTimeoutMs: 8000,
            roleMapJson: {},
            defaultRole: 'Students',
          },
        },
        transaction,
      });

      const existingUser = await models.User.findOne({
        where: { username: adminUsername },
        transaction,
      });
      if (existingUser) {
        throw new Error('Admin user already exists');
      }

      const existingEmail = await models.User.findOne({
        where: { email: adminEmail },
        transaction,
      });
      if (existingEmail) {
        throw new Error('Admin email already exists');
      }

      const adminUser = await models.User.create(
        {
          username: adminUsername,
          email: adminEmail,
          firstName: adminFirstName,
          lastName: adminLastName,
          password: adminPassword,
          isActive: true,
        },
        { transaction }
      );

      await models.UserRole.findOrCreate({
        where: {
          userId: adminUser.id,
          roleId: superAdminRole.id,
          lendingLocationId: null,
        },
        defaults: {
          userId: adminUser.id,
          roleId: superAdminRole.id,
          lendingLocationId: null,
        },
        transaction,
      });

      await models.Installation.create(
        {
          key: INSTALLATION_KEY,
          installedAt: new Date(),
          installedByUserId: adminUser.id,
          metadata: {
            roleId: superAdminRole.id,
            permissionKeys: permissions.map((perm) => perm.key),
          },
        },
        { transaction }
      );
    });
  }
}

module.exports = {
  InstallationService,
  permissionsSeed,
  INSTALLATION_KEY,
};
