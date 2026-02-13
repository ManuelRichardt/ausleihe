const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createServices } = require('../services');

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

async function run() {
  const username = getArg('--username') || getArg('-u');
  const password = getArg('--password') || getArg('-p');
  if (!username || !password) {
    throw new Error('Usage: node scripts/diagnose-login.js --username <name> --password <pass>');
  }

  const services = createServices();
  const user = await services.userService.getByUsername(username, { withPassword: true });

  process.stdout.write(`User loaded: ${Boolean(user)}\n`);
  process.stdout.write(`Password field present: ${Object.prototype.hasOwnProperty.call(user.dataValues, 'password')}\n`);
  process.stdout.write(`Password value set: ${Boolean(user.password)}\n`);

  const matches = await user.comparePassword(password);
  process.stdout.write(`comparePassword: ${matches}\n`);
}

run().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
