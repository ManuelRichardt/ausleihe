const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const models = require('../models');

async function run() {
  const qi = models.sequelize.getQueryInterface();
  const table = await qi.describeTable('asset_models');
  if (!table.specs) {
    await qi.addColumn('asset_models', 'specs', {
      type: models.Sequelize.JSON,
      allowNull: false,
      defaultValue: '{}',
    });
    process.stdout.write('Added column asset_models.specs\n');
  } else {
    process.stdout.write('Column asset_models.specs already exists\n');
  }
}

run()
  .then(async () => {
    await models.sequelize.close();
  })
  .catch(async (err) => {
    process.stderr.write(`${err.message || err}\n`);
    await models.sequelize.close();
    process.exit(1);
  });
