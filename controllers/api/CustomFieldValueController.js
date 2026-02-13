const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./_controllerUtils');

const services = createServices();

const setValue = handle(
  (req) =>
    services.customFieldValueService.setValue(
      req.params.assetInstanceId,
      req.params.customFieldDefinitionId,
      req.body.value
    ),
  { idempotent: true }
);
const getValuesByAssetInstance = handle((req) =>
  services.customFieldValueService.getValuesByAssetInstance(req.params.assetInstanceId, parseListOptions(req))
);
const removeValue = handle(async (req) => {
  await services.customFieldValueService.deleteValue(
    req.params.assetInstanceId,
    req.params.customFieldDefinitionId
  );
}, { idempotent: true });

module.exports = {
  setValue,
  getValuesByAssetInstance,
  removeValue,
};
