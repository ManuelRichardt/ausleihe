const ConfigService = require('../services/configService');
const models = require('../models');

const configService = new ConfigService(models);

async function getLdapConfig() {
  const provider = await configService.getAuthProvider('ldap');
  const config = provider && provider.config ? provider.config : {};
  return {
    provider,
    config,
    secrets: {
      bindDn: config.bindDn || null,
      bindPassword: config.bindPassword || null,
      tlsRejectUnauthorized: config.tlsRejectUnauthorized !== undefined ? Boolean(config.tlsRejectUnauthorized) : true,
    },
  };
}

module.exports = {
  getLdapConfig,
};
