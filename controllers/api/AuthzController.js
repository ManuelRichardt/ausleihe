const { createServices } = require('../../services');
const { handle } = require('./controllerUtils');

const services = createServices();

const userHasPermission = handle((req) => {
  const payload = {
    userRoles: req.body.userRoles,
    permissionKey: req.body.permissionKey,
    lendingLocationId: req.body.lendingLocationId,
  };
  return { allowed: services.authzService.userHasPermission(payload) };
});

module.exports = {
  userHasPermission,
};
