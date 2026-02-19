const { services, renderPage, renderError, handleError } = require('./controllerUtils');
const { buildAuditMetadata } = require('../../utils/requestContextHelper');

class AuthController {
  getSafeReturnTo(value) {
    if (!value) {
      return '/dashboard';
    }
    const stringValue = String(value);
    if (stringValue.startsWith('/') && !stringValue.startsWith('//') && !stringValue.includes('://')) {
      return stringValue;
    }
    return '/dashboard';
  }

  async logAuditSafely(data) {
    try {
      await services.auditLogService.logAction(data);
    } catch (err) {
      return;
    }
  }

  async completeLogin(req, res, user, provider, returnTo, successMessage) {
    await services.userService.ensureStudentRole(user.id);
    await services.authSessionService.login(req, user);
    await this.logAuditSafely({
      userId: user.id,
      action: 'login.success',
      entity: 'User',
      entityId: user.id,
      metadata: this.createLoginAuditPayload(req, provider),
    });
    if (successMessage && typeof req.flash === 'function') {
      req.flash('success', successMessage);
    }
    return res.redirect(returnTo);
  }

  async logLoginFailureAndFlash(req, provider, message, extraAuditMetadata = {}) {
    await this.logAuditSafely({
      userId: null,
      action: 'login.failed',
      entity: 'User',
      entityId: null,
      metadata: this.createLoginAuditPayload(req, provider, extraAuditMetadata),
    });
    if (typeof req.flash === 'function') {
      req.flash('error', message);
    }
  }

  redirectIfPasswordMissing(req, res, password) {
    if (password) {
      return false;
    }
    if (typeof req.flash === 'function') {
      req.flash('error', 'Passwort ist erforderlich.');
    }
    res.redirect('/login');
    return true;
  }

  getEnabledProviderStates() {
    return Promise.all([
      services.configService.isEnabled('saml'),
      services.configService.isEnabled('ldap'),
    ]).then(([samlEnabled, ldapEnabled]) => ({ samlEnabled, ldapEnabled }));
  }

  createLoginAuditPayload(req, provider, extra = {}) {
    return {
      provider,
      ...buildAuditMetadata(req, extra),
    };
  }

  async loginViaSaml(req, res, returnTo) {
    if (req.session) {
      req.session.authReturnTo = returnTo;
    }
    try {
      const redirectUrl = await services.samlAuthService.loginStart();
      return res.redirect(redirectUrl);
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', 'Shibboleth ist aktuell nicht verfügbar.');
      }
      return res.redirect('/login');
    }
  }

  async loginViaLdap(req, res, params) {
    const { username, password, returnTo } = params;
    if (this.redirectIfPasswordMissing(req, res, password)) {
      return;
    }
    try {
      const profile = await services.ldapAuthService.authenticate({ username, password });
      const user = await services.ldapProvisioningService.provision(profile);
      return this.completeLogin(req, res, user, 'ldap', returnTo);
    } catch (err) {
      await this.logLoginFailureAndFlash(req, 'ldap', 'LDAP Login fehlgeschlagen.');
      return res.redirect('/login');
    }
  }

  async loginViaLocal(req, res, params) {
    const { username, password, returnTo } = params;
    if (this.redirectIfPasswordMissing(req, res, password)) {
      return;
    }

    try {
      const user = await services.localAuthService.authenticate(username, password);
      return this.completeLogin(req, res, user, 'local', returnTo, 'Logged in');
    } catch (err) {
      const message =
        err && err.code === 'LOCAL_USER_NOT_FOUND'
          ? 'Kein lokales Konto gefunden. Bitte Shibboleth oder LDAP verwenden.'
          : 'Ungültige Zugangsdaten';
      await this.logLoginFailureAndFlash(req, 'local', message, { username });
      const nextParam = req.body.next || req.query.next;
      const redirectTo = nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login';
      return res.redirect(redirectTo);
    }
  }

  async showLogin(req, res, next) {
    try {
      const samlConfig = await services.configService.getAuthProvider('saml');
      const ldapConfig = await services.configService.getAuthProvider('ldap');
      return renderPage(res, 'auth/login', req, {
        breadcrumbs: [{ label: 'Login', href: '/login' }],
        showHeader: false,
        showSidebar: false,
        samlEnabled: Boolean(samlConfig && samlConfig.enabled),
        samlDisplayName: samlConfig && samlConfig.displayName ? samlConfig.displayName : 'Shibboleth',
        ldapEnabled: Boolean(ldapConfig && ldapConfig.enabled),
        ldapDisplayName: ldapConfig && ldapConfig.displayName ? ldapConfig.displayName : 'LDAP',
        next: req.query.next ? String(req.query.next) : '',
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async localLogin(req, res, next) {
    try {
      const { username, password } = req.body;
      const returnTo = this.getSafeReturnTo(req.body.next || req.query.next);
      const existingUser = await services.userService.findByUsername(username);
      const { samlEnabled, ldapEnabled } = await this.getEnabledProviderStates();

      // External provider routing takes precedence over local fallback.
      if (existingUser && existingUser.externalProvider === 'saml') {
        return this.loginViaSaml(req, res, returnTo);
      }
      if ((existingUser && existingUser.externalProvider === 'ldap') || (!existingUser && ldapEnabled)) {
        return this.loginViaLdap(req, res, { username, password, returnTo });
      }
      if (!existingUser && samlEnabled) {
        return this.loginViaSaml(req, res, returnTo);
      }
      return this.loginViaLocal(req, res, { username, password, returnTo });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async samlLogin(req, res, next) {
    try {
      const returnTo = this.getSafeReturnTo(req.query.next);
      if (req.session) {
        req.session.authReturnTo = returnTo;
      }
      const redirectUrl = await services.samlAuthService.loginStart();
      return res.redirect(redirectUrl);
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', 'Shibboleth ist aktuell nicht verfügbar.');
      }
      const nextParam = req.body.next || req.query.next;
      const redirectTo = nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login';
      return res.redirect(redirectTo);
    }
  }

  async samlCallback(req, res, next) {
    try {
      const extract = await services.samlAuthService.loginCallback(req);
      const normalized = services.samlProvisioningService.normalizeProfile(extract);
      const user = await services.samlProvisioningService.provision(normalized);
      const returnTo = this.getSafeReturnTo(req.session && req.session.authReturnTo);
      if (req.session) {
        delete req.session.authReturnTo;
      }
      return this.completeLogin(req, res, user, 'saml', returnTo);
    } catch (err) {
      await this.logLoginFailureAndFlash(req, 'saml', 'Shibboleth Login fehlgeschlagen.');
      return res.redirect('/login');
    }
  }

  async samlMetadata(req, res, next) {
    try {
      const xml = await services.samlAuthService.getMetadata();
      res.type('application/xml');
      return res.send(xml);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async ldapLogin(req, res, next) {
    try {
      const { username, password } = req.body;
      const profile = await services.ldapAuthService.authenticate({ username, password });
      const user = await services.ldapProvisioningService.provision(profile);
      const returnTo = this.getSafeReturnTo(req.body.next || req.query.next);
      return this.completeLogin(req, res, user, 'ldap', returnTo);
    } catch (err) {
      await this.logLoginFailureAndFlash(req, 'ldap', 'LDAP Login fehlgeschlagen.');
      return res.redirect('/login');
    }
  }

  async logout(req, res, next) {
    try {
      if (req && req.session && typeof req.flash === 'function') {
        req.flash('success', 'Logged out');
      }
      await services.authSessionService.logout(req);
      res.clearCookie('lending_location_id');
      return res.redirect('/login');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async accessDenied(req, res, next) {
    try {
      return renderError(res, req, 403, 'Access denied');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = AuthController;
