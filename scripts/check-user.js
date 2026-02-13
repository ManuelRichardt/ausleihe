const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const models = require('../models');

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

async function run() {
  const username = getArg('--username') || getArg('-u');
  const password = getArg('--password') || getArg('-p');
  if (!username) {
    throw new Error('Usage: node scripts/check-user.js --username <name> [--password <pass>]');
  }

  await models.sequelize.authenticate();
  const user = await models.User.unscoped().findOne({ where: { username } });
  if (!user) {
    process.stdout.write('User not found\n');
    return;
  }

  process.stdout.write(`User: ${user.username}\n`);
  process.stdout.write(`Active: ${user.isActive}\n`);
  process.stdout.write(`Password set: ${Boolean(user.password)}\n`);

  if (password) {
    const matches = await bcrypt.compare(password, user.password || '');
    process.stdout.write(`Password matches: ${matches}\n`);
  }
}

run().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
