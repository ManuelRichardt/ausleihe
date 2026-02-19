function getActorId(req) {
  return req && req.user ? req.user.id : null;
}

function getRequestContext(req, overrides = {}) {
  const actorId = getActorId(req);
  const context = {
    actorId,
    userId: actorId,
    ipAddress: req ? req.ip : null,
    userAgent: req && req.headers ? req.headers['user-agent'] : null,
    lendingLocationId:
      req && req.lendingLocationId ? req.lendingLocationId : null,
    requestId:
      req && req.headers ? (req.headers['x-request-id'] || null) : null,
  };
  return {
    ...context,
    ...overrides,
  };
}

function getActorContext(req, overrides = {}) {
  return getRequestContext(req, overrides);
}

function buildAuditMetadata(req, extra = {}) {
  const context = getRequestContext(req);
  return {
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
    ...extra,
  };
}

module.exports = {
  getActorId,
  getRequestContext,
  getActorContext,
  buildAuditMetadata,
};
