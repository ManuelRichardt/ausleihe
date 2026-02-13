const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const models = require('../models');
const { InstallationService } = require('../services/InstallationService');

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  if (String(value).toLowerCase().startsWith('change_me')) {
    throw new Error(`${name} must be set to a non-placeholder value`);
  }
  return value;
}

async function run() {
  const adminUsername = getEnv('INITIAL_ADMIN_USERNAME');
  const adminEmail = getEnv('INITIAL_ADMIN_EMAIL');
  const adminPassword = getEnv('INITIAL_ADMIN_PASSWORD');
  const { validatePasswordPolicy } = require('../utils/passwordPolicy');
  validatePasswordPolicy(adminPassword);
  const adminFirstName = process.env.INITIAL_ADMIN_FIRST_NAME || 'System';
  const adminLastName = process.env.INITIAL_ADMIN_LAST_NAME || 'Administrator';

  const installer = new InstallationService(models);
  await installer.run({
    adminUsername,
    adminEmail,
    adminPassword,
    adminFirstName,
    adminLastName,
  });

  process.stdout.write('Installation completed successfully.\n');
}

run().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
