const crypto = require('crypto');

const idempotencyStore = new Map();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

function parseBoolean(value) {
  if (value === undefined) {
    return undefined;
  }
  return value === true || value === 'true';
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
  for (const [key, entry] of idempotencyStore.entries()) {
    if (now - entry.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}

function handle(serviceCall, options = {}) {
  return async (req, res, next) => {
    try {
      const now = Date.now();
      cleanupIdempotency(now);

      if (options.ifMatch && req.headers['if-match']) {
        const current = await options.ifMatch(req);
        const currentTag = computeEtag({ data: current, error: null });
        if (req.headers['if-match'] !== currentTag) {
          const err = new Error('Precondition Failed');
          err.status = 412;
          err.code = 'PRECONDITION_FAILED';
          throw err;
        }
      }

      if (options.idempotent) {
        const key = req.headers['idempotency-key'];
        if (key) {
          const cacheKey = `${req.method}:${req.originalUrl}:${key}`;
          const cached = idempotencyStore.get(cacheKey);
          if (cached) {
            res.set('ETag', cached.etag || undefined);
            res.json(cached.body);
            return;
          }
          const result = await serviceCall(req);
          const data = result === undefined ? { success: true } : result;
          const body = { data, error: null };
          const etag = computeEtag(body);
          idempotencyStore.set(cacheKey, { timestamp: now, body, etag });
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
