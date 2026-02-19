function resolveLendingLocationId(req) {
  return (
    (req.params && req.params.lendingLocationId) ||
    (req.query && req.query.lendingLocationId) ||
    (req.body && req.body.lendingLocationId) ||
    null
  );
}

module.exports = {
  resolveLendingLocationId,
};
