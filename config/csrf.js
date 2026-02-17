const crypto = require('crypto');
const { doubleCsrf } = require('csrf-csrf');

function shouldUseSecureCookie() {
  const raw = String(process.env.CSRF_COOKIE_SECURE || '').toLowerCase();
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

const useSecureCookie = shouldUseSecureCookie();
const useHostPrefix = useSecureCookie;
const cookieName = useHostPrefix ? '__Host-csrf' : 'csrf';
const secret = process.env.CSRF_SECRET || process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const { generateCsrfToken: generateCsrfTokenInternal, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => secret,
  getSessionIdentifier: (req) => req.sessionID || (req.session && req.session.id) || req.ip || 'anonymous',
  cookieName,
  cookieOptions: {
    httpOnly: true,
    secure: useSecureCookie,
    sameSite: 'lax',
    path: '/',
  },
  getCsrfTokenFromRequest: (req) => {
    const normalize = (value) => {
      if (Array.isArray(value)) {
        return normalize(value[0]);
      }
      if (value === undefined || value === null) {
        return '';
      }
      return String(value);
    };
    const bodyToken =
      (req.body && (req.body.csrfToken || req.body._csrf)) ||
      '';
    const queryToken =
      (req.query && (req.query.csrfToken || req.query._csrf)) ||
      '';
    const headerToken =
      req.headers['x-csrf-token'] ||
      req.headers['csrf-token'] ||
      '';
    return normalize(bodyToken || queryToken || headerToken);
  },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

function csrfProtectionMiddleware(options = {}) {
  const ignorePaths = Array.isArray(options.ignorePaths) ? options.ignorePaths : [];
  const shouldIssueToken = (req) => {
    if (req.method !== 'GET') {
      return false;
    }
    const accept = String(req.headers.accept || '').toLowerCase();
    return accept.includes('text/html');
  };

  const issueTokenIfNeeded = (req, res) => {
    if (!shouldIssueToken(req)) {
      return;
    }
    res.locals.csrfToken = generateCsrfTokenInternal(req, res);
  };

  return (req, res, next) => {
    if (ignorePaths.includes(req.path)) {
      issueTokenIfNeeded(req, res);
      return next();
    }
    return doubleCsrfProtection(req, res, (err) => {
      if (err) {
        err.status = 403;
        return next(err);
      }
      issueTokenIfNeeded(req, res);
      return next();
    });
  };
}

function generateCsrfToken(req, res) {
  return generateCsrfTokenInternal(req, res);
}

module.exports = {
  csrfProtectionMiddleware,
  generateCsrfToken,
};
