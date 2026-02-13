const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./_controllerUtils');

const services = createServices();

const create = handle((req) => services.auditLogService.logAction(req.body), { idempotent: true });
const getById = handle((req) => services.auditLogService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.userId) {
    filter.userId = req.query.userId;
  }
  if (req.query.entity) {
    filter.entity = req.query.entity;
  }
  if (req.query.entityId) {
    filter.entityId = req.query.entityId;
  }
  return services.auditLogService.getAll(filter, parseListOptions(req));
});
const remove = handle(async (req) => {
  await services.auditLogService.deleteLog(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.auditLogService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  getAll,
  remove,
};
