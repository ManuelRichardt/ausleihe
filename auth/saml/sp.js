const saml = require('samlify');
const { getSamlConfig } = require('../../config/saml');

async function buildServiceProvider() {
  const { config, secrets } = await getSamlConfig();
  if (!config || !config.spEntityId || !config.acsUrl) {
    throw new Error('SAML SP configuration is incomplete');
  }

  return saml.ServiceProvider({
    entityID: config.spEntityId,
    clockSkew: config.clockSkewSec ? Number(config.clockSkewSec) * 1000 : undefined,
    assertionConsumerService: [
      {
        Binding: saml.Constants.namespace.binding.post,
        Location: config.acsUrl,
      },
    ],
    singleLogoutService: config.sloUrl
      ? [
          {
            Binding: saml.Constants.namespace.binding.redirect,
            Location: config.sloUrl,
          },
        ]
      : [],
    signingCert: secrets.spCert || undefined,
    privateKey: secrets.spPrivateKey || undefined,
    authnRequestsSigned: Boolean(secrets.spPrivateKey),
    wantAssertionsSigned: true,
    nameIDFormat: config.nameIdFormat || undefined,
  });
}

module.exports = {
  buildServiceProvider,
};
