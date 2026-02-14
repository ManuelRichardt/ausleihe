const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const models = require('../models');

async function run() {
  await models.sequelize.authenticate();
  const queryInterface = models.sequelize.getQueryInterface();
  await queryInterface.dropTable('auth_provider_secret_refs');
  process.stdout.write('Dropped table auth_provider_secret_refs.\n');
}

run()
  .catch((err) => {
    if (err && /unknown table/i.test(String(err.message || err))) {
      process.stdout.write('Table auth_provider_secret_refs does not exist.\n');
      process.exit(0);
      return;
    }
    process.stderr.write(`${err.message || err}\n`);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await models.sequelize.close();
    } catch (err) {
      // noop
    }
  });
