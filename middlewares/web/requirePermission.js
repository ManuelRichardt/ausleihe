const { createServices } = require('../../services');

const services = createServices();

module.exports = function requirePermission(permissionKey, scopeResolver) {
  return async function permissionMiddleware(req, res, next) {
    if (!req.user) {
      return res.redirect('/login');
    }
    const lendingLocationId =
      typeof scopeResolver === 'function'
        ? await scopeResolver(req)
        : null;
    const userRoles = Array.isArray(req.userRoles) ? req.userRoles : [];
    const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
    const allowed = keys.some((key) =>
      services.authzService.hasPermission({
        userRoles,
        permissionKey: key,
        lendingLocationId,
      })
    );
    if (!allowed) {
      return res.redirect('/access-denied');
    }
    return next();
  };
};
