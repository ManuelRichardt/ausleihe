const saml = require('samlify');
const { getSamlConfig } = require('../config/saml');

async function buildIdentityProvider() {
  const { config, secrets } = await getSamlConfig();
  if (!config || !config.idpEntityId || !config.idpSsoUrl) {
    throw new Error('SAML IdP configuration is incomplete');
  }
  if (!secrets.idpCert) {
    throw new Error('SAML IdP certificate is required');
  }

  return saml.IdentityProvider({
    entityID: config.idpEntityId,
    singleSignOnService: [
      {
        Binding: saml.Constants.namespace.binding.redirect,
        Location: config.idpSsoUrl,
      },
    ],
    singleLogoutService: config.idpSloUrl
      ? [
          {
            Binding: saml.Constants.namespace.binding.redirect,
            Location: config.idpSloUrl,
          },
        ]
      : [],
    signingCert: secrets.idpCert,
  });
}

module.exports = {
  buildIdentityProvider,
};
