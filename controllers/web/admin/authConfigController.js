const { services, renderPage, handleError } = require('../controllerUtils');

class AuthConfigController {
  async index(req, res, next) {
    try {
      const samlConfig = await services.configService.getAuthProvider('saml');
      const ldapConfig = await services.configService.getAuthProvider('ldap');
      return renderPage(res, 'admin/auth-config/index', req, {
        breadcrumbs: [
          { label: 'System', href: '/system/lending-locations' },
          { label: 'Auth Config', href: '/system/auth-config' },
        ],
        samlConfig,
        ldapConfig,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  parseClockSkew(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return 120;
    }
    return parsed;
  }

  async updateSaml(req, res, next) {
    try {
      const enabled = req.body.enabled === 'on' || req.body.enabled === 'true';
      const displayName = req.body.displayName || 'Shibboleth';
      const config = {
        spEntityId: req.body.spEntityId || '',
        acsUrl: req.body.acsUrl || '',
        sloUrl: req.body.sloUrl || '',
        idpEntityId: req.body.idpEntityId || '',
        idpSsoUrl: req.body.idpSsoUrl || '',
        idpSloUrl: req.body.idpSloUrl || '',
        nameIdFormat: req.body.nameIdFormat || '',
        clockSkewSec: this.parseClockSkew(req.body.clockSkewSec),
      };

      const errors = {};
      if (enabled) {
        if (!config.spEntityId) {
          errors.spEntityId = 'SP Entity ID ist erforderlich';
        }
        if (!config.acsUrl) {
          errors.acsUrl = 'ACS URL ist erforderlich';
        }
        if (!config.idpEntityId) {
          errors.idpEntityId = 'IdP Entity ID ist erforderlich';
        }
        if (!config.idpSsoUrl) {
          errors.idpSsoUrl = 'IdP SSO URL ist erforderlich';
        }
        if (!process.env.SAML_IDP_CERT_PEM) {
          errors.idpCert = 'SAML IdP Zertifikat fehlt (ENV)';
        }
      }

      if (Object.keys(errors).length) {
        res.status(422);
        return renderPage(res, 'admin/auth-config/index', req, {
          samlConfig: { enabled, displayName, config },
          ldapConfig: await services.configService.getAuthProvider('ldap'),
          errors,
          formData: req.body,
        });
      }

      await services.configService.setAuthProvider('saml', {
        enabled,
        displayName,
        config,
      });

      if (typeof req.flash === 'function') {
        req.flash('success', 'SAML Konfiguration gespeichert');
      }
      return res.redirect('/system/auth-config');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async updateLdap(req, res, next) {
    try {
      const enabled = req.body.ldapEnabled === 'on' || req.body.ldapEnabled === 'true';
      const displayName = req.body.ldapDisplayName || 'LDAP';
      const roleMapRaw = req.body.roleMapJson || '';
      let roleMapJson = {};
      const timeoutMs = parseInt(req.body.timeoutMs || '8000', 10);
      const connectTimeoutMs = parseInt(req.body.connectTimeoutMs || '8000', 10);

      if (roleMapRaw) {
        try {
          roleMapJson = JSON.parse(roleMapRaw);
        } catch (err) {
          roleMapJson = null;
        }
      }

      const config = {
        url: req.body.url || '',
        baseDn: req.body.baseDn || '',
        userFilter: req.body.userFilter || '',
        userDnTemplate: req.body.userDnTemplate || '',
        searchScope: req.body.searchScope || 'sub',
        bindDn: req.body.bindDn || '',
        bindPassword: req.body.bindPassword || '',
        tlsRejectUnauthorized: req.body.tlsRejectUnauthorized === undefined
          ? true
          : req.body.tlsRejectUnauthorized === 'on' || req.body.tlsRejectUnauthorized === 'true',
        attrUsername: req.body.attrUsername || 'uid',
        attrEmail: req.body.attrEmail || 'mail',
        attrDisplayName: req.body.attrDisplayName || 'displayName',
        attrFirstName: req.body.attrFirstName || 'givenName',
        attrLastName: req.body.attrLastName || 'sn',
        attrExternalId: req.body.attrExternalId || 'entryUUID',
        attrGroups: req.body.attrGroups || 'memberOf',
        startTls: req.body.startTls === 'on' || req.body.startTls === 'true',
        timeoutMs: Number.isNaN(timeoutMs) ? 8000 : timeoutMs,
        connectTimeoutMs: Number.isNaN(connectTimeoutMs) ? 8000 : connectTimeoutMs,
        roleMapJson: roleMapJson || {},
        defaultRole: req.body.defaultRole || 'Students',
      };

      const errors = {};
      if (enabled) {
        if (!config.url) {
          errors.url = 'LDAP URL ist erforderlich';
        }
        if (!config.baseDn) {
          errors.baseDn = 'Base DN ist erforderlich';
        }
        if (!config.userFilter && !config.userDnTemplate) {
          errors.userFilter = 'User Filter oder DN Template ist erforderlich';
        }
      }
      if (roleMapRaw && roleMapJson === null) {
        errors.roleMapJson = 'Role Map JSON ist ungültig';
      }
      if (config.searchScope && !['base', 'one', 'sub'].includes(config.searchScope)) {
        errors.searchScope = 'Search Scope muss base, one oder sub sein';
      }

      if (Object.keys(errors).length) {
        res.status(422);
        return renderPage(res, 'admin/auth-config/index', req, {
          samlConfig: await services.configService.getAuthProvider('saml'),
          ldapConfig: { enabled, displayName, config },
          errors,
          formData: req.body,
        });
      }

      await services.configService.setAuthProvider('ldap', {
        enabled,
        displayName,
        config,
      });

      if (typeof req.flash === 'function') {
        req.flash('success', 'LDAP Konfiguration gespeichert');
      }
      return res.redirect('/system/auth-config');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async testLdap(req, res, next) {
    try {
      const username = req.body.testUsername || '';
      const password = req.body.testPassword || '';
      await services.ldapAuthService.testConnection({ username, password });
      if (typeof req.flash === 'function') {
        req.flash('success', 'LDAP Verbindung erfolgreich getestet');
      }
      return res.redirect('/system/auth-config');
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', 'LDAP Test fehlgeschlagen');
      }
      return res.redirect('/system/auth-config');
    }
  }
}

module.exports = AuthConfigController;
