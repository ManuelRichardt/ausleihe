const AuthzService = require('../../../services/AuthzService');
const { services, handleError } = require('../controllerUtils');

class LendingLocationContextController {
  async setActive(req, res, next) {
    try {
      const locationId = req.body.lendingLocationId || null;
      const returnTo = req.body.returnTo || '/';
      if (!locationId) {
        const err = new Error('Lending location is required');
        err.status = 422;
        throw err;
      }

      const location = await services.lendingLocationService.getById(locationId);
      if (!location) {
        const err = new Error('Lending location not found');
        err.status = 404;
        throw err;
      }

      const authz = new AuthzService();
      const userRoles = req.userRoles || [];
      const canSystemAdmin = authz.hasPermission({
        userRoles,
        permissionKey: 'system.admin',
        lendingLocationId: null,
      });
      const hasRoleForLocation = userRoles.some((role) => role.lendingLocationId === locationId);

      if (!canSystemAdmin && !hasRoleForLocation) {
        const err = new Error('Access denied');
        err.status = 403;
        throw err;
      }

      const cookieOptions = {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        maxAge: 1000 * 60 * 60 * 24 * 30,
      };
      res.cookie('lending_location_id', locationId, cookieOptions);

      if (typeof req.session !== 'undefined') {
        req.session.lendingLocationId = locationId;
      }

      if (returnTo && typeof returnTo === 'string' && returnTo.startsWith('/')) {
        return res.redirect(returnTo);
      }
      return res.redirect('/');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = LendingLocationContextController;
