function assertOwnedByLendingLocation(entity, lendingLocationId, entityName) {
  if (!entity) {
    const err = new Error(`${entityName || 'Entity'} not found`);
    err.status = 404;
    throw err;
  }
  if (!lendingLocationId) {
    return;
  }
  if (entity.lendingLocationId !== lendingLocationId) {
    const err = new Error(`${entityName || 'Entity'} not found`);
    err.status = 404;
    throw err;
  }
}

module.exports = {
  assertOwnedByLendingLocation,
};
