const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./controllerUtils');

const services = createServices();

const create = handle((req) => services.openingExceptionService.createException(req.body), { idempotent: true });
const getById = handle((req) => services.openingExceptionService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.lendingLocationId) {
    filter.lendingLocationId = req.query.lendingLocationId;
  }
  if (req.query.date) {
    filter.date = req.query.date;
  }
  return services.openingExceptionService.getAll(filter, parseListOptions(req));
});
const update = handle((req) => services.openingExceptionService.updateException(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.openingExceptionService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.openingExceptionService.deleteException(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.openingExceptionService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  getAll,
  update,
  remove,
};
