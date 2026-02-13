const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./_controllerUtils');

const services = createServices();

const create = handle((req) => services.roleService.createRole(req.body, { actorId: req.user ? req.user.id : null }), { idempotent: true });
const getById = handle((req) => services.roleService.getById(req.params.id));
const search = handle((req) => {
  const filter = {};
  if (req.query.q) {
    filter.query = req.query.q;
  }
  if (req.query.name) {
    filter.name = req.query.name;
  }
  if (req.query.scope) {
    filter.scope = req.query.scope;
  }
  if (req.query.description) {
    filter.description = req.query.description;
  }
  return services.roleService.searchRoles(filter, parseListOptions(req));
});
const getAll = handle((req) => services.roleService.getAll(parseListOptions(req)));
const update = handle((req) => services.roleService.updateRole(req.params.id, req.body, { actorId: req.user ? req.user.id : null }), {
  idempotent: true,
  ifMatch: (req) => services.roleService.getById(req.params.id),
});
const addPermission = handle((req) => services.roleService.addPermission(req.params.id, req.body.permissionId, { actorId: req.user ? req.user.id : null }), {
  idempotent: true,
  ifMatch: (req) => services.roleService.getById(req.params.id),
});
const removePermission = handle(async (req) => {
  await services.roleService.removePermission(req.params.id, req.body.permissionId, { actorId: req.user ? req.user.id : null });
}, {
  idempotent: true,
  ifMatch: (req) => services.roleService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.roleService.deleteRole(req.params.id, { actorId: req.user ? req.user.id : null });
}, {
  idempotent: true,
  ifMatch: (req) => services.roleService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  search,
  getAll,
  update,
  addPermission,
  removePermission,
  remove,
};
