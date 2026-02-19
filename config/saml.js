const ConfigService = require('../services/configService');
const models = require('../models');

const configService = new ConfigService(models);

function normalizePem(value) {
  if (!value) {
    return null;
  }
  return String(value).replace(/\\n/g, '\n');
}

async function getSamlConfig() {
  const provider = await configService.getAuthProvider('saml');
  const config = provider && provider.config ? provider.config : {};
  const spPrivateKey = normalizePem(process.env.SAML_SP_PRIVATE_KEY_PEM);
  const spCert = normalizePem(process.env.SAML_SP_CERT_PEM);
  const idpCert = normalizePem(process.env.SAML_IDP_CERT_PEM);
  return {
    provider,
    config,
    secrets: {
      spPrivateKey,
      spCert,
      idpCert,
    },
  };
}

module.exports = {
  getSamlConfig,
};
