function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function getSessionCookieSecure() {
  const raw = String(process.env.SESSION_COOKIE_SECURE || 'auto').toLowerCase();
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return isProduction() ? 'auto' : false;
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is required');
  }
  return secret;
}

function buildSessionConfig() {
  return {
    name: 'sid',
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: getSessionCookieSecure(),
      maxAge: 1000 * 60 * 60 * 8,
    },
  };
}

module.exports = buildSessionConfig;
