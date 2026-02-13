const { createServices } = require('../../services');
const { parseBoolean, parseListOptions, handle } = require('./_controllerUtils');

const services = createServices();

const create = handle((req) => services.assetModelService.createAssetModel(req.body), { idempotent: true });
const getById = handle((req) => services.assetModelService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.manufacturerId) {
    filter.manufacturerId = req.query.manufacturerId;
  }
  if (req.query.categoryId) {
    filter.categoryId = req.query.categoryId;
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = parseBoolean(req.query.isActive);
  }
  return services.assetModelService.getAll(filter, parseListOptions(req));
});
const update = handle((req) => services.assetModelService.updateAssetModel(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.assetModelService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.assetModelService.deleteAssetModel(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.assetModelService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  getAll,
  update,
  remove,
};
