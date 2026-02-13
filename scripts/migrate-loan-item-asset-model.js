const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const models = require('../models');

async function columnExists() {
  const [rows] = await models.sequelize.query(
    "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loan_items' AND COLUMN_NAME = 'asset_model_id'"
  );
  return rows && rows[0] && rows[0].cnt > 0;
}

async function indexExists(name) {
  const [rows] = await models.sequelize.query(
    "SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loan_items' AND INDEX_NAME = ?",
    { replacements: [name] }
  );
  return rows && rows[0] && rows[0].cnt > 0;
}

async function run() {
  await models.sequelize.authenticate();

  if (!(await columnExists())) {
    await models.sequelize.query(
      "ALTER TABLE loan_items ADD COLUMN asset_model_id CHAR(36) NOT NULL AFTER asset_id"
    );
  }

  if (!(await indexExists('loan_items_asset_model_id'))) {
    await models.sequelize.query(
      'CREATE INDEX loan_items_asset_model_id ON loan_items (asset_model_id)'
    );
  }

  process.stdout.write('Migration completed.\n');
  await models.sequelize.close();
}

run().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
