const { buildMenu, fallbackMenu } = require('../navigation/menu.service');
const { buildBreadcrumbs } = require('../navigation/breadcrumbs.service');
const { createPermissionHelper } = require('../helpers/permission.helper');
const models = require('../models');

module.exports = async function navigationMiddleware(req, res, next) {
  const userRoles = req.userRoles || [];
  const lendingLocationId = req.lendingLocationId || null;

  let navigation = buildMenu({
    userRoles,
    lendingLocationId,
    currentPath: req.path,
  });

  if (!navigation || navigation.length === 0) {
    navigation = fallbackMenu();
  }

  const breadcrumbs = buildBreadcrumbs(navigation, req.path);
  const permissionHelper = createPermissionHelper(userRoles, lendingLocationId);

  let lendingLocations = [];
  try {
    if (permissionHelper.can('system.admin')) {
      lendingLocations = await models.LendingLocation.findAll({ order: [['name', 'ASC']] });
    } else if (userRoles.length) {
      const ids = Array.from(new Set(userRoles.map((role) => role.lendingLocationId).filter(Boolean)));
      if (ids.length) {
        lendingLocations = await models.LendingLocation.findAll({
          where: { id: ids },
          order: [['name', 'ASC']],
        });
      }
    }
  } catch (err) {
    lendingLocations = [];
  }

  res.locals.navigation = navigation;
  res.locals.breadcrumbs = breadcrumbs;
  res.locals.currentUser = req.user || null;
  const activeLendingLocation = lendingLocations.find((loc) => loc.id === lendingLocationId) || null;
  res.locals.activeLendingLocation = activeLendingLocation;
  res.locals.lendingLocations = lendingLocations;
  res.locals.permissionHelper = permissionHelper;
  res.locals.can = permissionHelper.can;
  res.locals.canAny = permissionHelper.canAny;
  res.locals.canAll = permissionHelper.canAll;
  req.breadcrumbs = breadcrumbs;

  next();
};
