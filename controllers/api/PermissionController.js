const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./controllerUtils');

const services = createServices();

const create = handle((req) => services.permissionService.createPermission(req.body, { actorId: req.user ? req.user.id : null }), { idempotent: true });
const getById = handle((req) => services.permissionService.getById(req.params.id));
const getByKey = handle((req) => services.permissionService.getByKey(req.params.key));
const search = handle((req) => {
  const filter = {};
  if (req.query.q) {
    filter.query = req.query.q;
  }
  if (req.query.key) {
    filter.key = req.query.key;
  }
  if (req.query.scope) {
    filter.scope = req.query.scope;
  }
  if (req.query.description) {
    filter.description = req.query.description;
  }
  return services.permissionService.searchPermissions(filter, parseListOptions(req));
});
const getAll = handle((req) => services.permissionService.getAll(parseListOptions(req)));
const update = handle((req) => services.permissionService.updatePermission(req.params.id, req.body, { actorId: req.user ? req.user.id : null }), {
  idempotent: true,
  ifMatch: (req) => services.permissionService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.permissionService.deletePermission(req.params.id, { actorId: req.user ? req.user.id : null });
}, {
  idempotent: true,
  ifMatch: (req) => services.permissionService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  getByKey,
  search,
  getAll,
  update,
  remove,
};
