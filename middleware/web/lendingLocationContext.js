function getSessionValue(req, key) {
  if (!req || !req.session) {
    return null;
  }
  return req.session[key] || null;
}

module.exports = function lendingLocationContext(req, res, next) {
  let locationId =
    req.params.lendingLocationId ||
    req.params.locationId ||
    req.body.lendingLocationId ||
    req.query.lendingLocationId ||
    (req.cookies && req.cookies.lending_location_id) ||
    getSessionValue(req, 'lendingLocationId') ||
    (req.user && req.user.lendingLocationId) ||
    null;

  if (!locationId && Array.isArray(req.userRoles) && req.userRoles.length) {
    const unique = Array.from(
      new Set(
        req.userRoles
          .map((role) => role.lendingLocationId)
          .filter((id) => id)
      )
    );
    if (unique.length === 1) {
      locationId = unique[0];
    }
  }

  req.lendingLocationId = locationId || null;
  res.locals.lendingLocationId = req.lendingLocationId;
  next();
};
