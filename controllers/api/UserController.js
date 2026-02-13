const { createServices } = require('../../services');
const { parseBoolean, parseListOptions, handle } = require('./_controllerUtils');

const services = createServices();

const create = handle((req) => services.userService.createUser(req.body), { idempotent: true });

const getById = handle((req) =>
  services.userService.getById(req.params.id, {
    withPassword: parseBoolean(req.query.withPassword),
  })
);

const getByUsername = handle((req) =>
  services.userService.getByUsername(req.params.username, {
    withPassword: parseBoolean(req.query.withPassword),
  })
);

const search = handle((req) => {
  const filter = {};
  if (req.query.q) {
    filter.query = req.query.q;
  }
  if (req.query.username) {
    filter.username = req.query.username;
  }
  if (req.query.email) {
    filter.email = req.query.email;
  }
  if (req.query.firstName) {
    filter.firstName = req.query.firstName;
  }
  if (req.query.lastName) {
    filter.lastName = req.query.lastName;
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = parseBoolean(req.query.isActive);
  }
  return services.userService.searchUsers(filter, parseListOptions(req));
});

const getAll = handle((req) => {
  const filter = {};
  if (req.query.isActive !== undefined) {
    filter.isActive = parseBoolean(req.query.isActive);
  }
  return services.userService.getAll(filter, parseListOptions(req));
});

const update = handle((req) => services.userService.updateUser(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.userService.getById(req.params.id),
});

const setPassword = handle((req) => services.userService.setPassword(req.params.id, req.body.password), {
  idempotent: true,
  ifMatch: (req) => services.userService.getById(req.params.id),
});

const setActive = handle((req) => services.userService.setActive(req.params.id, req.body.isActive), {
  idempotent: true,
  ifMatch: (req) => services.userService.getById(req.params.id),
});

const remove = handle(async (req) => {
  await services.userService.deleteUser(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.userService.getById(req.params.id),
});

const assignRole = handle((req) =>
  services.userService.assignRole(
    {
      userId: req.body.userId || req.params.id,
      roleId: req.body.roleId,
      lendingLocationId: req.body.lendingLocationId,
    },
    { actorId: req.user ? req.user.id : null }
  ),
  { idempotent: true }
);

const revokeRole = handle(async (req) => {
  await services.userService.revokeRole(
    {
      userId: req.body.userId || req.params.id,
      roleId: req.body.roleId,
      lendingLocationId: req.body.lendingLocationId,
    },
    { actorId: req.user ? req.user.id : null }
  );
}, { idempotent: true });

const listUserRoles = handle((req) => services.userService.listUserRoles(req.params.id));

module.exports = {
  create,
  getById,
  getByUsername,
  search,
  getAll,
  update,
  setPassword,
  setActive,
  remove,
  assignRole,
  revokeRole,
  listUserRoles,
};
