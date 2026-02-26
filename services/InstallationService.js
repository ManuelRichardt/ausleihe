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

const ROLE_DEFINITIONS = Object.freeze({
  superAdmin: {
    where: { name: 'Super Admin' },
    defaults: {
      name: 'Super Admin',
      description: 'Systemweite Administration (ohne Ausleihe-Rechte)',
      scope: 'global',
    },
  },
  locationAdmin: {
    where: { name: 'Admin', scope: 'ausleihe' },
    defaults: {
      name: 'Admin',
      description: 'Adminrechte innerhalb einer Ausleihe',
      scope: 'ausleihe',
    },
  },
  student: {
    where: { name: 'Students', scope: 'global' },
    defaults: {
      name: 'Students',
      description: 'Studierende mit Reservierungsrecht',
      scope: 'global',
    },
  },
  loanDesk: {
    where: { name: 'Ausleihe Operator', scope: 'ausleihe' },
    defaults: {
      name: 'Ausleihe Operator',
      description: 'Ausgaben bearbeiten, übergeben und zurücknehmen',
      scope: 'ausleihe',
    },
  },
  inventoryManager: {
    where: { name: 'Inventarverwaltung', scope: 'ausleihe' },
    defaults: {
      name: 'Inventarverwaltung',
      description: 'Inventarverwaltung für Kategorien, Hersteller, Modelle und Assets',
      scope: 'ausleihe',
    },
  },
});

const ROLE_PERMISSION_KEYS = Object.freeze({
  superAdmin: [
    'system.admin',
    'users.manage',
    'roles.manage',
    'permissions.manage',
    'customfields.manage',
    'audit.view',
    'system.auth.manage',
  ],
  locationAdmin: [
    'admin.access',
    'lendinglocations.manage',
    'loan.create',
    'loan.manage',
    'inventory.manage',
    'openinghours.manage',
  ],
  student: ['loan.create'],
  loanDesk: ['admin.access', 'loan.manage'],
  inventoryManager: ['admin.access', 'inventory.manage'],
});

const AUTH_PROVIDER_SEED = Object.freeze([
  {
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
  },
  {
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
  },
]);

const uiTextSeed = [
  { key: 'nav.home', de: 'Startseite', en: 'Home' },
  { key: 'nav.toggle', de: 'Navigation umschalten', en: 'Toggle navigation' },
  { key: 'nav.lending_locations', de: 'Labore', en: 'Labs' },
  { key: 'nav.categories', de: 'Kategorien', en: 'Categories' },
  { key: 'nav.assets', de: 'Assets', en: 'Assets' },
  { key: 'nav.guest', de: 'Gast', en: 'Guest' },
  { key: 'nav.profile', de: 'Profil', en: 'Profile' },
  { key: 'nav.cart', de: 'Warenkorb', en: 'Cart' },
  { key: 'nav.my_reservations', de: 'Meine Reservierungen', en: 'My reservations' },
  { key: 'nav.my_loans', de: 'Meine Ausleihen', en: 'My loans' },
  { key: 'nav.logout', de: 'Logout', en: 'Logout' },
  { key: 'nav.lending_location', de: 'Ausleihe', en: 'Lending location' },
  { key: 'nav.select_lending_location', de: 'Ausleihe wählen', en: 'Choose lending location' },
  { key: 'common.select', de: 'Bitte wählen', en: 'Please select' },
  { key: 'common.apply', de: 'Setzen', en: 'Apply' },
  { key: 'admin.sidebar.title', de: 'Admin-Panel', en: 'Admin panel' },
  { key: 'admin.sidebar.close', de: 'Admin-Panel schließen', en: 'Close admin panel' },
  { key: 'admin.sidebar.inventory_management', de: 'Inventar Verwaltung', en: 'Inventory management' },
  { key: 'admin.sidebar.print_pdf', de: 'Druck & PDF', en: 'Print & PDF' },
  { key: 'admin.sidebar.loans', de: 'Ausleihe', en: 'Loans' },
  { key: 'admin.sidebar.system', de: 'System', en: 'System' },
  { key: 'admin.sidebar.mail', de: 'Mail-System', en: 'Mail system' },
  { key: 'admin.sidebar.privacy', de: 'Datenschutz', en: 'Privacy' },
];

function createInstallationAlreadyCompletedError() {
  const err = new Error('Installation already completed');
  err.code = 'INSTALLATION_ALREADY_COMPLETED';
  err.status = 409;
  return err;
}

const mailTemplateSeed = [
  {
    key: 'reservation_confirmation',
    subjectDe: 'Reservierungsbestätigung {{loanId}}',
    subjectEn: 'Reservation confirmation {{loanId}}',
    bodyDe: 'Hallo {{firstName}},\n\nIhre Reservierung {{loanId}} wurde erfasst.\nAusleihe: {{lendingLocation}}\nVon: {{reservedFrom}}\nBis: {{reservedUntil}}\n\nViele Grüße',
    bodyEn: 'Hello {{firstName}},\n\nyour reservation {{loanId}} has been created.\nLending location: {{lendingLocation}}\nFrom: {{reservedFrom}}\nUntil: {{reservedUntil}}\n\nBest regards',
  },
  {
    key: 'pickup_reminder',
    subjectDe: 'Abhol-Erinnerung {{loanId}}',
    subjectEn: 'Pickup reminder {{loanId}}',
    bodyDe: 'Hallo {{firstName}},\n\ndiese Nachricht erinnert an die Abholung für Reservierung {{loanId}}.',
    bodyEn: 'Hello {{firstName}},\n\nthis is a pickup reminder for reservation {{loanId}}.',
  },
  {
    key: 'return_reminder',
    subjectDe: 'Rückgabe-Erinnerung {{loanId}}',
    subjectEn: 'Return reminder {{loanId}}',
    bodyDe: 'Hallo {{firstName}},\n\ndiese Nachricht erinnert an die Rückgabe für Ausleihe {{loanId}} bis {{reservedUntil}}.',
    bodyEn: 'Hello {{firstName}},\n\nthis is a return reminder for loan {{loanId}} until {{reservedUntil}}.',
  },
  {
    key: 'overdue_notice',
    subjectDe: 'Überfällige Rückgabe {{loanId}}',
    subjectEn: 'Overdue return {{loanId}}',
    bodyDe: 'Hallo {{firstName}},\n\nAusleihe {{loanId}} ist überfällig. Bitte geben Sie die Gegenstände zurück.',
    bodyEn: 'Hello {{firstName}},\n\nloan {{loanId}} is overdue. Please return the items.',
  },
  {
    key: 'reservation_cancelled',
    subjectDe: 'Storno-Info {{loanId}}',
    subjectEn: 'Cancellation info {{loanId}}',
    bodyDe: 'Hallo {{firstName}},\n\nReservierung {{loanId}} wurde storniert.',
    bodyEn: 'Hello {{firstName}},\n\nreservation {{loanId}} has been cancelled.',
  },
];

class InstallationService {
  constructor(models) {
    this.models = models;
  }

  async seedPermissions(transaction) {
    const permissions = [];
    for (const permissionSeedEntry of permissionsSeed) {
      const [record] = await this.models.Permission.findOrCreate({
        where: { key: permissionSeedEntry.key },
        defaults: {
          key: permissionSeedEntry.key,
          description: permissionSeedEntry.description,
          scope: permissionSeedEntry.scope || DEFAULT_PERMISSION_SCOPE,
        },
        transaction,
      });
      permissions.push(record);
    }
    return permissions;
  }

  async seedRoles(transaction) {
    const roles = {};
    for (const [roleKey, roleDefinition] of Object.entries(ROLE_DEFINITIONS)) {
      const [role] = await this.models.Role.findOrCreate({
        where: roleDefinition.where,
        defaults: roleDefinition.defaults,
        transaction,
      });
      roles[roleKey] = role;
    }
    return roles;
  }

  async seedRolePermissions({ permissions, roles, transaction }) {
    const permissionMap = permissions.reduce((acc, permission) => {
      acc[permission.key] = permission;
      return acc;
    }, {});

    const rolePermissionRows = Object.entries(ROLE_PERMISSION_KEYS).flatMap(([roleKey, permissionKeys]) => {
      const role = roles[roleKey];
      if (!role) {
        return [];
      }
      return permissionKeys
        .map((permissionKey) => permissionMap[permissionKey])
        .filter(Boolean)
        .map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        }));
    });

    if (!rolePermissionRows.length) {
      return;
    }

    await this.models.RolePermission.bulkCreate(rolePermissionRows, {
      transaction,
      ignoreDuplicates: true,
    });
  }

  async seedAuthProviders(transaction) {
    for (const authProviderConfig of AUTH_PROVIDER_SEED) {
      await this.models.AuthProviderConfig.findOrCreate({
        where: authProviderConfig.where,
        defaults: authProviderConfig.defaults,
        transaction,
      });
    }
  }

  async seedUiTexts(transaction) {
    for (const text of uiTextSeed) {
      const [entry] = await this.models.UiText.findOrCreate({
        where: { key: text.key },
        defaults: {
          key: text.key,
          de: text.de || '',
          en: text.en || '',
          isActive: true,
        },
        transaction,
      });
      await entry.update(
        {
          de: entry.de || text.de || '',
          en: entry.en || text.en || '',
        },
        { transaction }
      );
    }
  }

  async seedMailTemplates(transaction) {
    for (const template of mailTemplateSeed) {
      const [entry] = await this.models.MailTemplate.findOrCreate({
        where: { key: template.key },
        defaults: {
          key: template.key,
          subjectDe: template.subjectDe,
          subjectEn: template.subjectEn,
          bodyDe: template.bodyDe,
          bodyEn: template.bodyEn,
          isActive: true,
        },
        transaction,
      });
      await entry.update(
        {
          subjectDe: entry.subjectDe || template.subjectDe,
          subjectEn: entry.subjectEn || template.subjectEn,
          bodyDe: entry.bodyDe || template.bodyDe,
          bodyEn: entry.bodyEn || template.bodyEn,
        },
        { transaction }
      );
    }
  }

  async createInitialAdmin({ adminUserData, superAdminRole, permissions, transaction }) {
    const existingUser = await this.models.User.findOne({
      where: { username: adminUserData.adminUsername },
      transaction,
    });
    if (existingUser) {
      throw new Error('Admin user already exists');
    }

    const existingEmail = await this.models.User.findOne({
      where: { email: adminUserData.adminEmail },
      transaction,
    });
    if (existingEmail) {
      throw new Error('Admin email already exists');
    }

    const adminUser = await this.models.User.create(
      {
        username: adminUserData.adminUsername,
        email: adminUserData.adminEmail,
        firstName: adminUserData.adminFirstName,
        lastName: adminUserData.adminLastName,
        password: adminUserData.adminPassword,
        isActive: true,
      },
      { transaction }
    );

    await this.models.UserRole.findOrCreate({
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

    await this.models.Installation.create(
      {
        key: INSTALLATION_KEY,
        installedAt: new Date(),
        installedByUserId: adminUser.id,
        metadata: {
          roleId: superAdminRole.id,
          permissionKeys: permissions.map((permission) => permission.key),
        },
      },
      { transaction }
    );

    return adminUser;
  }

  async runInitialInstallation({
    adminUsername,
    adminEmail,
    adminPassword,
    adminFirstName,
    adminLastName,
  }) {
    const { sequelize } = this.models;
    await sequelize.authenticate();
    await sequelize.sync();

    const existingInstallation = await this.models.Installation.findOne({
      where: { key: INSTALLATION_KEY },
    });
    if (existingInstallation) {
      throw createInstallationAlreadyCompletedError();
    }

    await sequelize.transaction(async (transaction) => {
      // Order matters: permissions and roles must exist before role-permission links are created.
      const permissions = await this.seedPermissions(transaction);
      const roles = await this.seedRoles(transaction);
      await this.seedRolePermissions({ permissions, roles, transaction });
      await this.seedAuthProviders(transaction);
      await this.seedUiTexts(transaction);

      const existingMailConfig = await this.models.MailConfig.findOne({ transaction });
      if (!existingMailConfig) {
        await this.models.MailConfig.create(
          {
            isEnabled: false,
            transport: 'smtp',
            fromEmail: '',
            fromName: '',
            replyTo: '',
            smtpHost: '',
            smtpPort: 587,
            smtpSecure: false,
            smtpUser: '',
            smtpPass: '',
            sendmailPath: '/usr/sbin/sendmail',
          },
          { transaction }
        );
      }

      const existingPrivacyConfig = await this.models.PrivacyConfig.findOne({ transaction });
      if (!existingPrivacyConfig) {
        await this.models.PrivacyConfig.create(
          {
            isEnabled: true,
            returnedLoanRetentionMonths: 3,
            autoDeleteExternalUsers: true,
          },
          { transaction }
        );
      }

      await this.seedMailTemplates(transaction);

      await this.createInitialAdmin({
        adminUserData: {
          adminUsername,
          adminEmail,
          adminPassword,
          adminFirstName,
          adminLastName,
        },
        superAdminRole: roles.superAdmin,
        permissions,
        transaction,
      });
    });
  }

}

module.exports = {
  InstallationService,
  permissionsSeed,
  uiTextSeed,
  mailTemplateSeed,
  INSTALLATION_KEY,
  ROLE_PERMISSION_KEYS,
};
