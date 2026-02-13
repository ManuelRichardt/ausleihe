const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const models = require('../models');

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

async function run() {
  const username = getArg('--username') || getArg('-u') || process.env.INITIAL_ADMIN_USERNAME;
  const password = getArg('--password') || getArg('-p') || process.env.INITIAL_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('Usage: node scripts/reset-admin-password.js --username <name> --password <pass>');
  }

  const { validatePasswordPolicy } = require('../utils/passwordPolicy');
  validatePasswordPolicy(password);

  await models.sequelize.authenticate();
  await models.sequelize.sync();

  const user = await models.User.unscoped().findOne({ where: { username } });
  if (!user) {
    throw new Error('User not found');
  }

  await user.update({ password, isActive: true });
  process.stdout.write('Password updated\n');
}

run().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
