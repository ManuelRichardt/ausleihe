const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const models = require('../models');

async function columnExists(table, column) {
  const [rows] = await models.sequelize.query(
    "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    { replacements: [table, column] }
  );
  return rows && rows[0] && rows[0].cnt > 0;
}

async function addColumn(table, column) {
  const exists = await columnExists(table, column);
  if (exists) {
    return;
  }
  await models.sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} TIME NULL`);
}

async function run() {
  await models.sequelize.authenticate();

  const columns = ['pickup_open_time', 'pickup_close_time', 'return_open_time', 'return_close_time'];
  for (const column of columns) {
    await addColumn('opening_hours', column);
    await addColumn('opening_exceptions', column);
  }

  process.stdout.write('Migration completed.\n');
  await models.sequelize.close();
}

run().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
