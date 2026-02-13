const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const models = require('../models');
const AuthService = require('../services/AuthService');

async function run() {
  await models.sequelize.authenticate();
  const authService = new AuthService(models);
  const deleted = await authService.cleanupExpiredRefreshTokens();
  process.stdout.write(`Deleted refresh tokens: ${deleted}\n`);
}

run().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
