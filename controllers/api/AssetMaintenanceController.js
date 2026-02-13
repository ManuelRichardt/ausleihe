const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./_controllerUtils');

const services = createServices();

const create = handle((req) => services.assetMaintenanceService.reportMaintenance(req.body), { idempotent: true });
const getById = handle((req) => services.assetMaintenanceService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.assetId) {
    filter.assetId = req.query.assetId;
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }
  return services.assetMaintenanceService.getAll(filter, parseListOptions(req));
});
const update = handle((req) => services.assetMaintenanceService.updateMaintenance(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.assetMaintenanceService.getById(req.params.id),
});
const complete = handle(
  (req) => services.assetMaintenanceService.completeMaintenance(req.params.id, req.body.completedAt),
  {
    idempotent: true,
    ifMatch: (req) => services.assetMaintenanceService.getById(req.params.id),
  }
);
const remove = handle(async (req) => {
  await services.assetMaintenanceService.deleteMaintenance(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.assetMaintenanceService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  getAll,
  update,
  complete,
  remove,
};
