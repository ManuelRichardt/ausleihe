const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const models = require('../models');

async function run() {
  await models.sequelize.authenticate();
  const dialect = models.sequelize.getDialect();
  if (dialect !== 'mariadb' && dialect !== 'mysql') {
    process.stdout.write('Skip: only MySQL/MariaDB supported.\n');
    return;
  }

  const [indexes] = await models.sequelize.query('SHOW INDEX FROM user_roles');
  if (!Array.isArray(indexes)) {
    process.stdout.write('No indexes found.\n');
    return;
  }

  const byKey = indexes.reduce((acc, row) => {
    if (!acc[row.Key_name]) {
      acc[row.Key_name] = { columns: [], nonUnique: row.Non_unique };
    }
    acc[row.Key_name].columns.push(row.Column_name);
    return acc;
  }, {});

  for (const key of Object.keys(byKey)) {
    const meta = byKey[key];
    if (key === 'PRIMARY') {
      continue;
    }
    const cols = meta.columns;
    const isUnique = meta.nonUnique === 0;
    const hasLocation = cols.includes('lending_location_id');
    if (isUnique && !hasLocation) {
      await models.sequelize.query(`DROP INDEX ${key} ON user_roles`);
    }
  }

  const compositeKey = Object.keys(byKey).find((key) => {
    const cols = byKey[key].columns;
    return cols.includes('user_id') && cols.includes('role_id') && cols.includes('lending_location_id') && cols.length === 3;
  });

  if (!compositeKey) {
    await models.sequelize.query(
      'CREATE UNIQUE INDEX user_roles_user_role_location_unique ON user_roles (user_id, role_id, lending_location_id)'
    );
  }

  process.stdout.write('user_roles index fixed.\n');
}

run().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
