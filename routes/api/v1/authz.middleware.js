const { createServices } = require('../../../services');

const services = createServices();

function requirePermission(permissionKey, scopeResolver) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        const err = new Error('Unauthorized');
        err.status = 401;
        err.code = 'UNAUTHORIZED';
        return next(err);
      }
      const lendingLocationId = scopeResolver ? await scopeResolver(req) : null;
      const userRoles = req.userRoles || (req.user ? req.user.userRoles : null);
      const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
      const allowed = keys.some((key) =>
        services.authzService.hasPermission({
          userRoles,
          permissionKey: key,
          lendingLocationId,
        })
      );
      if (!allowed) {
        const err = new Error('Forbidden');
        err.status = 403;
        err.code = 'FORBIDDEN';
        return next(err);
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = {
  requirePermission,
};
