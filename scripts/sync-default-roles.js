const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const models = require('../models');
const { permissionsSeed } = require('../services/InstallationService');

async function findOrCreateRole(transaction, name, description, scope) {
  const [role] = await models.Role.findOrCreate({
    where: { name, scope },
    defaults: { name, description, scope },
    transaction,
  });
  return role;
}

async function run() {
  await models.sequelize.authenticate();
  await models.sequelize.sync();

  await models.sequelize.transaction(async (transaction) => {
    const permissions = [];
    for (const perm of permissionsSeed) {
      const [record] = await models.Permission.findOrCreate({
        where: { key: perm.key },
        defaults: {
          key: perm.key,
          description: perm.description,
          scope: perm.scope || 'both',
        },
        transaction,
      });
      permissions.push(record);
    }

    const permissionMap = permissions.reduce((acc, perm) => {
      acc[perm.key] = perm;
      return acc;
    }, {});

    const roles = [
      {
        name: 'Ausleihe Operator',
        description: 'Ausgaben bearbeiten, übergeben und zurücknehmen',
        scope: 'ausleihe',
        permissionKeys: ['admin.access', 'loan.manage'],
      },
      {
        name: 'Inventarverwaltung',
        description: 'Inventarverwaltung für Kategorien, Hersteller, Modelle und Assets',
        scope: 'ausleihe',
        permissionKeys: ['admin.access', 'inventory.manage'],
      },
    ];

    for (const roleSeed of roles) {
      const role = await findOrCreateRole(
        transaction,
        roleSeed.name,
        roleSeed.description,
        roleSeed.scope
      );
      for (const permissionKey of roleSeed.permissionKeys) {
        const permission = permissionMap[permissionKey];
        if (!permission) {
          continue;
        }
        await models.RolePermission.findOrCreate({
          where: {
            roleId: role.id,
            permissionId: permission.id,
          },
          defaults: {
            roleId: role.id,
            permissionId: permission.id,
          },
          transaction,
        });
      }
    }
  });

  process.stdout.write('Default roles synchronized successfully.\n');
}

run().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
