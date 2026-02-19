const { createServices } = require('../../services');
const { parseBoolean, parseListOptions, handle } = require('./controllerUtils');

const services = createServices();

const create = handle((req) => services.storageLocationService.createStorageLocation(req.body), { idempotent: true });
const getById = handle((req) => services.storageLocationService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.lendingLocationId) {
    filter.lendingLocationId = req.query.lendingLocationId;
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = parseBoolean(req.query.isActive);
  }
  return services.storageLocationService.getAll(filter, parseListOptions(req));
});
const update = handle((req) => services.storageLocationService.updateStorageLocation(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.storageLocationService.getById(req.params.id),
});
const setActive = handle((req) => services.storageLocationService.setActive(req.params.id, req.body.isActive), {
  idempotent: true,
  ifMatch: (req) => services.storageLocationService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.storageLocationService.deleteStorageLocation(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.storageLocationService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  getAll,
  update,
  setActive,
  remove,
};
