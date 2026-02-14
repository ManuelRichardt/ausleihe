const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const models = require('../models');

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) {
    process.stdout.write(`Column ${tableName}.${columnName} already exists\n`);
    return;
  }
  await queryInterface.addColumn(tableName, columnName, definition);
  process.stdout.write(`Added column ${tableName}.${columnName}\n`);
}

async function run() {
  const qi = models.sequelize.getQueryInterface();

  await addColumnIfMissing(qi, 'lending_locations', 'image_url', {
    type: models.Sequelize.STRING(500),
    allowNull: true,
  });

  await addColumnIfMissing(qi, 'asset_categories', 'image_url', {
    type: models.Sequelize.STRING(500),
    allowNull: true,
  });
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
