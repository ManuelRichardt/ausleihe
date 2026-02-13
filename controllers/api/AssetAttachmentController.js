const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./_controllerUtils');

const services = createServices();

const create = handle((req) => services.assetAttachmentService.addAttachment(req.body), { idempotent: true });
const getById = handle((req) => services.assetAttachmentService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.assetModelId) {
    filter.assetModelId = req.query.assetModelId;
  }
  if (req.query.assetId) {
    filter.assetId = req.query.assetId;
  }
  if (req.query.kind) {
    filter.kind = req.query.kind;
  }
  return services.assetAttachmentService.getAll(filter, parseListOptions(req));
});
const update = handle((req) => services.assetAttachmentService.updateAttachment(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.assetAttachmentService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.assetAttachmentService.deleteAttachment(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.assetAttachmentService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  getAll,
  update,
  remove,
};
