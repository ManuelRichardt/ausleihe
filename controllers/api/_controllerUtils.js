const crypto = require('crypto');
const { parseBooleanToken } = require('../../utils/valueParsing');

const idempotencyStore = new Map();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const STATUS = Object.freeze({
  PRECONDITION_FAILED: 412,
});
const ERROR_CODE = Object.freeze({
  PRECONDITION_FAILED: 'PRECONDITION_FAILED',
});

function parseBoolean(value) {
  return parseBooleanToken(value, {
    trueTokens: ['true', '1', 'yes'],
    falseTokens: ['false', '0', 'no'],
    defaultValue: undefined,
  });
}

function parseListOptions(req) {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
  const limit = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : undefined;
  const offset = Number.isFinite(page) && page > 0 && limit ? (page - 1) * limit : undefined;
  const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
  const sortOrder = req.query.sortOrder ? String(req.query.sortOrder).toUpperCase() : undefined;
  const order = sortBy ? [[sortBy, sortOrder === 'DESC' ? 'DESC' : 'ASC']] : undefined;
  return { limit, offset, order };
}

function computeEtag(payload) {
  const json = JSON.stringify(payload);
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  return `"${hash}"`;
}

function cleanupIdempotency(now) {
  // Idempotency cache is process-local; multi-instance deployments need shared storage.
  for (const [key, entry] of idempotencyStore.entries()) {
    if (now - entry.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}

async function ensureIfMatch(req, options) {
  if (!options.ifMatch || !req.headers['if-match']) {
    return;
  }
  const current = await options.ifMatch(req);
  const currentTag = computeEtag({ data: current, error: null });
  if (req.headers['if-match'] !== currentTag) {
    const err = new Error('Precondition Failed');
    err.status = STATUS.PRECONDITION_FAILED;
    err.code = ERROR_CODE.PRECONDITION_FAILED;
    throw err;
  }
}

function readIdempotencyCache(req) {
  const key = req.headers['idempotency-key'];
  if (!key) {
    return null;
  }
  const cacheKey = `${req.method}:${req.originalUrl}:${key}`;
  return { key: cacheKey, entry: idempotencyStore.get(cacheKey) };
}

function writeIdempotencyCache(cacheKey, body, now) {
  const etag = computeEtag(body);
  idempotencyStore.set(cacheKey, { timestamp: now, body, etag });
  return etag;
}

function handle(serviceCall, options = {}) {
  return async (req, res, next) => {
    try {
      const now = Date.now();
      cleanupIdempotency(now);
      await ensureIfMatch(req, options);

      if (options.idempotent) {
        const cachedPayload = readIdempotencyCache(req);
        if (cachedPayload) {
          if (cachedPayload.entry) {
            res.set('ETag', cachedPayload.entry.etag || undefined);
            res.json(cachedPayload.entry.body);
            return;
          }
          const result = await serviceCall(req);
          const data = result === undefined ? { success: true } : result;
          const body = { data, error: null };
          const etag = writeIdempotencyCache(cachedPayload.key, body, now);
          res.set('ETag', etag);
          res.json(body);
          return;
        }
      }

      const result = await serviceCall(req);
      const data = result === undefined ? { success: true } : result;
      const body = { data, error: null };
      if (req.method === 'GET') {
        res.set('ETag', computeEtag(body));
      }
      res.json(body);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  parseBoolean,
  parseListOptions,
  handle,
};
