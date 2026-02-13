const { createServices } = require('../../services');
const { parseBoolean, parseListOptions, handle } = require('./_controllerUtils');

const services = createServices();

const create = handle((req) => services.assetInstanceService.createAsset(req.body), { idempotent: true });
const getById = handle((req) => services.assetInstanceService.getById(req.params.id));
const search = handle((req) => {
  const filter = {};
  if (req.query.q) {
    filter.query = req.query.q;
  }
  if (req.query.inventoryNumber) {
    filter.inventoryNumber = req.query.inventoryNumber;
  }
  if (req.query.serialNumber) {
    filter.serialNumber = req.query.serialNumber;
  }
  if (req.query.name) {
    filter.name = req.query.name;
  }
  if (req.query.manufacturer) {
    filter.manufacturer = req.query.manufacturer;
  }
  if (req.query.description) {
    filter.description = req.query.description;
  }
  if (req.query.lendingLocationId) {
    filter.lendingLocationId = req.query.lendingLocationId;
  }
  if (req.query.assetModelId) {
    filter.assetModelId = req.query.assetModelId;
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = parseBoolean(req.query.isActive);
  }
  return services.assetInstanceService.searchAssets(filter, parseListOptions(req));
});
const getAll = handle((req) => {
  const filter = {};
  if (req.query.lendingLocationId) {
    filter.lendingLocationId = req.query.lendingLocationId;
  }
  if (req.query.assetModelId) {
    filter.assetModelId = req.query.assetModelId;
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = parseBoolean(req.query.isActive);
  }
  return services.assetInstanceService.getAll(filter, parseListOptions(req));
});
const update = handle((req) => services.assetInstanceService.updateAsset(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.assetInstanceService.getById(req.params.id),
});
const moveStorageLocation = handle(
  (req) => services.assetInstanceService.moveStorageLocation(req.params.id, req.body.storageLocationId),
  {
    idempotent: true,
    ifMatch: (req) => services.assetInstanceService.getById(req.params.id),
  }
);
const setCondition = handle((req) => services.assetInstanceService.setCondition(req.params.id, req.body.condition), {
  idempotent: true,
  ifMatch: (req) => services.assetInstanceService.getById(req.params.id),
});
const setActive = handle((req) => services.assetInstanceService.setActive(req.params.id, req.body.isActive), {
  idempotent: true,
  ifMatch: (req) => services.assetInstanceService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.assetInstanceService.deleteAsset(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.assetInstanceService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  search,
  getAll,
  update,
  moveStorageLocation,
  setCondition,
  setActive,
  remove,
};
