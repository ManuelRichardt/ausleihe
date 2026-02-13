const { services, renderPage, renderError, handleError } = require('./_controllerUtils');

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

  async safeAudit(data) {
    try {
      await services.auditLogService.logAction(data);
    } catch (err) {
      return;
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
      const localUser = await services.userService.findByUsername(username);
      const samlEnabled = await services.configService.isEnabled('saml');
      const ldapEnabled = await services.configService.isEnabled('ldap');

      if (localUser && localUser.externalProvider === 'saml') {
        const returnTo = this.getSafeReturnTo(req.body.next || req.query.next);
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

      if ((localUser && localUser.externalProvider === 'ldap') || (!localUser && ldapEnabled)) {
        if (!password) {
          if (typeof req.flash === 'function') {
            req.flash('error', 'Passwort ist erforderlich.');
          }
          return res.redirect('/login');
        }
        try {
          const profile = await services.ldapAuthService.authenticate({ username, password });
          const user = await services.ldapProvisioningService.provision(profile);
          await services.userService.ensureStudentRole(user.id);
          await services.authSessionService.login(req, user);
          await this.safeAudit({
            userId: user.id,
            action: 'login.success',
            entity: 'User',
            entityId: user.id,
            metadata: {
              provider: 'ldap',
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            },
          });
          const returnTo = this.getSafeReturnTo(req.body.next || req.query.next);
          return res.redirect(returnTo);
        } catch (err) {
          await this.safeAudit({
            userId: null,
            action: 'login.failed',
            entity: 'User',
            entityId: null,
            metadata: {
              provider: 'ldap',
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            },
          });
          if (typeof req.flash === 'function') {
            req.flash('error', 'LDAP Login fehlgeschlagen.');
          }
          return res.redirect('/login');
        }
      }

      if (!localUser && samlEnabled) {
        const returnTo = this.getSafeReturnTo(req.body.next || req.query.next);
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

      if (!password) {
        if (typeof req.flash === 'function') {
          req.flash('error', 'Passwort ist erforderlich.');
        }
        return res.redirect('/login');
      }
      try {
        const user = await services.localAuthService.authenticate(username, password);
        await services.userService.ensureStudentRole(user.id);
        await services.authSessionService.login(req, user);
        await this.safeAudit({
          userId: user.id,
          action: 'login.success',
          entity: 'User',
          entityId: user.id,
          metadata: {
            provider: 'local',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });
        if (typeof req.flash === 'function') {
          req.flash('success', 'Logged in');
        }
        const returnTo = this.getSafeReturnTo(req.body.next || req.query.next);
        return res.redirect(returnTo);
      } catch (err) {
        const message =
          err && err.code === 'LOCAL_USER_NOT_FOUND'
            ? 'Kein lokales Konto gefunden. Bitte Shibboleth oder LDAP verwenden.'
            : 'Ungültige Zugangsdaten';
        await this.safeAudit({
          userId: null,
          action: 'login.failed',
          entity: 'User',
          entityId: null,
          metadata: {
            provider: 'local',
            username,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });
        if (typeof req.flash === 'function') {
          req.flash('error', message);
        }
        const nextParam = req.body.next || req.query.next;
        const redirectTo = nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login';
        return res.redirect(redirectTo);
      }
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
      await services.userService.ensureStudentRole(user.id);
      await services.authSessionService.login(req, user);
      await this.safeAudit({
        userId: user.id,
        action: 'login.success',
        entity: 'User',
        entityId: user.id,
        metadata: {
          provider: 'saml',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
      const returnTo = this.getSafeReturnTo(req.session && req.session.authReturnTo);
      if (req.session) {
        delete req.session.authReturnTo;
      }
      return res.redirect(returnTo);
    } catch (err) {
      await this.safeAudit({
        userId: null,
        action: 'login.failed',
        entity: 'User',
        entityId: null,
        metadata: {
          provider: 'saml',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
      if (typeof req.flash === 'function') {
        req.flash('error', 'Shibboleth Login fehlgeschlagen.');
      }
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
      await services.userService.ensureStudentRole(user.id);
      await services.authSessionService.login(req, user);
      await this.safeAudit({
        userId: user.id,
        action: 'login.success',
        entity: 'User',
        entityId: user.id,
        metadata: {
          provider: 'ldap',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
      const returnTo = this.getSafeReturnTo(req.body.next || req.query.next);
      return res.redirect(returnTo);
    } catch (err) {
      await this.safeAudit({
        userId: null,
        action: 'login.failed',
        entity: 'User',
        entityId: null,
        metadata: {
          provider: 'ldap',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
      if (typeof req.flash === 'function') {
        req.flash('error', 'LDAP Login fehlgeschlagen.');
      }
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
