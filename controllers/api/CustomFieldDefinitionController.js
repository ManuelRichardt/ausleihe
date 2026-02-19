const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./controllerUtils');

const services = createServices();

const create = handle((req) => services.customFieldDefinitionService.create(req.body), { idempotent: true });
const getById = handle((req) => services.customFieldDefinitionService.getById(req.params.id));
const getByAssetModel = handle((req) =>
  services.customFieldDefinitionService.getByAssetModel(req.params.assetModelId, parseListOptions(req))
);
const getByLendingLocation = handle((req) =>
  services.customFieldDefinitionService.getByLendingLocation(req.params.lendingLocationId, parseListOptions(req))
);
const update = handle((req) => services.customFieldDefinitionService.update(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.customFieldDefinitionService.getById(req.params.id),
});
const deactivate = handle((req) => services.customFieldDefinitionService.deactivate(req.params.id), {
  idempotent: true,
  ifMatch: (req) => services.customFieldDefinitionService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.customFieldDefinitionService.delete(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.customFieldDefinitionService.getById(req.params.id),
});
const resolveForAssetInstance = handle((req) =>
  services.customFieldDefinitionService.resolveCustomFieldsForAssetInstance(req.params.assetInstanceId)
);

module.exports = {
  create,
  getById,
  getByAssetModel,
  getByLendingLocation,
  update,
  deactivate,
  remove,
  resolveForAssetInstance,
};
