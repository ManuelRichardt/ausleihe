const { createServices } = require('../../services');
const { parseBoolean, parseListOptions, handle } = require('./controllerUtils');

const services = createServices();

const create = handle((req) => services.lendingLocationService.createLocation(req.body), { idempotent: true });
const getById = handle((req) => services.lendingLocationService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.isActive !== undefined) {
    filter.isActive = parseBoolean(req.query.isActive);
  }
  return services.lendingLocationService.getAll(filter, parseListOptions(req));
});
const update = handle((req) => services.lendingLocationService.updateLocation(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.lendingLocationService.getById(req.params.id),
});
const setActive = handle((req) => services.lendingLocationService.setActive(req.params.id, req.body.isActive), {
  idempotent: true,
  ifMatch: (req) => services.lendingLocationService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.lendingLocationService.deleteLocation(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.lendingLocationService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  getAll,
  update,
  setActive,
  remove,
};
