const crypto = require('crypto');

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const full = padded + '='.repeat(padLength);
  return Buffer.from(full, 'base64').toString('utf8');
}

function signToken(payload, secret, expiresInSeconds) {
  if (!secret) {
    throw new Error('ACCESS_TOKEN_SECRET is required');
  }
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: expiresInSeconds ? now + expiresInSeconds : undefined,
  };
  if (!expiresInSeconds) {
    delete body.exp;
  }
  const encoded = base64UrlEncode(JSON.stringify(body));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encoded}.${signature}`;
}

function verifyToken(token, secret) {
  if (!secret) {
    throw new Error('ACCESS_TOKEN_SECRET is required');
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid token');
  }
  const [encoded, signature] = parts;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(base64UrlDecode(encoded));
  if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
    throw new Error('Token expired');
  }
  return payload;
}

module.exports = {
  signToken,
  verifyToken,
};
