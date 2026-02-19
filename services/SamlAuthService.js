const ConfigService = require('./ConfigService');
const samlAuth = require('./samlProtocolService');

class SamlAuthService {
  constructor(models) {
    this.models = models;
    this.configService = new ConfigService(models);
  }

  async ensureEnabled() {
    const enabled = await this.configService.isEnabled('saml');
    if (!enabled) {
      const err = new Error('SAML is disabled');
      err.status = 403;
      throw err;
    }
    return true;
  }

  async loginStart() {
    await this.ensureEnabled();
    const redirectUrl = await samlAuth.createLoginRequest();
    return redirectUrl;
  }

  async loginCallback(req) {
    await this.ensureEnabled();
    const profile = await samlAuth.parseLoginResponse(req);
    if (!profile) {
      throw new Error('SAML response invalid');
    }
    return profile;
  }

  async getMetadata() {
    return samlAuth.getSpMetadataXml();
  }
}

module.exports = SamlAuthService;
