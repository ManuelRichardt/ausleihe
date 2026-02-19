const { createServices } = require('../../services');
const AuthSessionService = require('../../services/authSessionService');

const services = createServices();
const authSessionService = new AuthSessionService();

module.exports = async function injectUser(req, res, next) {
  try {
    const userId = authSessionService.getUserId(req);
    if (!userId) {
      req.user = null;
      req.userRoles = [];
      res.locals.user = null;
      res.locals.userRoles = [];
      return next();
    }

    const user = await services.userService.getById(userId, { includeDeleted: true });
    if (!user || user.deletedAt || !user.isActive) {
      await authSessionService.logout(req);
      req.user = null;
      req.userRoles = [];
      res.locals.user = null;
      res.locals.userRoles = [];
      if (req.path !== '/login') {
        return res.redirect('/login');
      }
      return next();
    }

    const userRoles = await services.userService.listUserRoles(userId);
    req.user = user;
    req.userRoles = userRoles;
    res.locals.user = user;
    res.locals.userRoles = userRoles;

    const existingLocationCookie = req.cookies && req.cookies.lending_location_id;
    const uniqueLocations = Array.from(
      new Set(
        (userRoles || [])
          .map((role) => role.lendingLocationId)
          .filter((id) => id)
      )
    );
    const allowedLocations = new Set(uniqueLocations);
    let selectedLocationId = null;

    if (existingLocationCookie && allowedLocations.has(existingLocationCookie)) {
      selectedLocationId = existingLocationCookie;
    }
    if (!selectedLocationId && uniqueLocations.length === 1) {
      selectedLocationId = uniqueLocations[0];
    }

    if (selectedLocationId) {
      req.lendingLocationId = selectedLocationId;
      res.locals.lendingLocationId = selectedLocationId;
      if (existingLocationCookie !== selectedLocationId) {
        res.cookie('lending_location_id', selectedLocationId, {
          httpOnly: true,
          sameSite: 'lax',
          secure: String(process.env.NODE_ENV || '').toLowerCase() === 'production',
          maxAge: 1000 * 60 * 60 * 8,
        });
      }
    } else if (existingLocationCookie && !allowedLocations.has(existingLocationCookie)) {
      res.clearCookie('lending_location_id');
    }

    return next();
  } catch (err) {
    req.user = null;
    req.userRoles = [];
    res.locals.user = null;
    res.locals.userRoles = [];
    return next();
  }
};
