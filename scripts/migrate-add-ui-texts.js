const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const models = require('../models');

async function hasTable(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables
    .map((item) => (typeof item === 'string' ? item : item.tableName || item.TABLE_NAME))
    .includes(tableName);
}

async function run() {
  const queryInterface = models.sequelize.getQueryInterface();
  await models.sequelize.authenticate();

  const tableName = 'ui_texts';
  const exists = await hasTable(queryInterface, tableName);
  if (!exists) {
    await queryInterface.createTable(tableName, {
      id: {
        type: models.Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      key: {
        type: models.Sequelize.STRING(191),
        allowNull: false,
        unique: true,
      },
      de: {
        type: models.Sequelize.TEXT,
        allowNull: true,
      },
      en: {
        type: models.Sequelize.TEXT,
        allowNull: true,
      },
      is_active: {
        type: models.Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: models.Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: models.Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: models.Sequelize.DATE,
        allowNull: true,
      },
    });
    await queryInterface.addIndex(tableName, ['key'], { unique: true, name: 'ui_texts_key_unique' });
    await queryInterface.addIndex(tableName, ['is_active'], { name: 'ui_texts_is_active_idx' });
  }

  process.stdout.write('Migration completed: ui_texts\n');
  await models.sequelize.close();
}

run().catch(async (err) => {
  process.stderr.write(`${err.message || err}\n`);
  try {
    await models.sequelize.close();
  } catch (closeErr) {
    // ignore
  }
  process.exit(1);
});
