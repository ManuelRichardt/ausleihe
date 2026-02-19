const { createServices } = require('../../services');
const { parseBoolean, parseListOptions, handle } = require('./controllerUtils');

const services = createServices();

const create = handle((req) => services.manufacturerService.createManufacturer(req.body), { idempotent: true });
const getById = handle((req) => services.manufacturerService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.isActive !== undefined) {
    filter.isActive = parseBoolean(req.query.isActive);
  }
  return services.manufacturerService.getAll(filter, parseListOptions(req));
});
const update = handle((req) => services.manufacturerService.updateManufacturer(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.manufacturerService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.manufacturerService.deleteManufacturer(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.manufacturerService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  getAll,
  update,
  remove,
};
