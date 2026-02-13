const saml = require('samlify');
const { buildServiceProvider } = require('./sp');
const { buildIdentityProvider } = require('./idp');

let validatorReady = false;

function ensureValidator() {
  if (!validatorReady) {
    saml.setSchemaValidator({
      validate: () => Promise.resolve('skipped'),
    });
    validatorReady = true;
  }
}

async function getEntities() {
  ensureValidator();
  const sp = await buildServiceProvider();
  const idp = await buildIdentityProvider();
  return { sp, idp };
}

async function createLoginRequest() {
  const { sp, idp } = await getEntities();
  const { context } = sp.createLoginRequest(idp, 'redirect');
  return context;
}

async function parseLoginResponse(req) {
  const { sp, idp } = await getEntities();
  const parsed = await sp.parseLoginResponse(idp, 'post', {
    body: req.body,
  });
  return parsed && parsed.extract ? parsed.extract : null;
}

async function getSpMetadataXml() {
  const { sp } = await getEntities();
  return sp.getMetadata();
}

module.exports = {
  createLoginRequest,
  parseLoginResponse,
  getSpMetadataXml,
};
