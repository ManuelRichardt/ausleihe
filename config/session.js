function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function getSessionCookieMaxAgeMs() {
  const raw = parseInt(process.env.SESSION_COOKIE_MAX_AGE_MS || String(1000 * 60 * 60 * 8), 10);
  if (Number.isNaN(raw) || raw <= 0) {
    return 1000 * 60 * 60 * 8;
  }
  return raw;
}

function getSessionCookieSecure() {
  const raw = String(process.env.SESSION_COOKIE_SECURE || 'auto').toLowerCase();
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return isProduction();
}

function getSessionCookieSameSite() {
  const raw = String(process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (['strict', 'lax', 'none'].includes(raw)) {
    return raw;
  }
  return 'lax';
}

function isWeakSessionSecret(secret) {
  if (!secret || secret.length < 32) {
    return true;
  }
  const lowered = secret.toLowerCase();
  const weakMarkers = ['change_me', 'changeme', 'replace_with', 'example', 'default', 'password'];
  return weakMarkers.some((marker) => lowered.includes(marker));
}

function getSessionSecret() {
  const secret = String(process.env.SESSION_SECRET || '');
  if (!secret) {
    throw new Error('SESSION_SECRET is required');
  }
  if (isWeakSessionSecret(secret)) {
    throw new Error(
      'SESSION_SECRET is too weak (use at least 32 random characters and no placeholder text)'
    );
  }
  return secret;
}

function getSessionCookieName() {
  return String(process.env.SESSION_COOKIE_NAME || 'sid').trim() || 'sid';
}

function buildSessionConfig(options = {}) {
  const secure = getSessionCookieSecure();
  const sameSite = getSessionCookieSameSite();
  if (sameSite === 'none' && secure !== true) {
    throw new Error('SESSION_COOKIE_SAME_SITE=none requires SESSION_COOKIE_SECURE=true');
  }

  return {
    name: getSessionCookieName(),
    secret: getSessionSecret(),
    proxy: isProduction(),
    store: options.store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite,
      secure,
      maxAge: getSessionCookieMaxAgeMs(),
      path: '/',
    },
  };
}

module.exports = buildSessionConfig;
