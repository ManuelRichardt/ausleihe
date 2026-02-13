const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./_controllerUtils');

const services = createServices();

const setRegularHours = handle((req) => services.openingHourService.setRegularHours(req.body), { idempotent: true });
const getAllRegularHours = handle((req) =>
  services.openingHourService.getAllRegularHours(req.params.lendingLocationId, parseListOptions(req))
);
const setException = handle((req) => services.openingHourService.setException(req.body), { idempotent: true });
const getAll = handle((req) =>
  services.openingHourService.getAllExceptions(req.params.lendingLocationId, parseListOptions(req))
);
const deleteRegularHours = handle(async (req) => {
  await services.openingHourService.deleteRegularHours(req.params.lendingLocationId, req.params.dayOfWeek);
}, { idempotent: true });
const deleteException = handle(async (req) => {
  await services.openingHourService.deleteException(req.params.lendingLocationId, req.params.date);
}, { idempotent: true });

module.exports = {
  setRegularHours,
  getAllRegularHours,
  setException,
  getAll,
  deleteRegularHours,
  deleteException,
};
