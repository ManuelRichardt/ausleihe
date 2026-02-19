const { createServices } = require('../../services');
const { parseBoolean, parseListOptions, handle } = require('./controllerUtils');

const services = createServices();

const create = handle((req) => services.assetCategoryService.createCategory(req.body), { idempotent: true });
const getById = handle((req) => services.assetCategoryService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.isActive !== undefined) {
    filter.isActive = parseBoolean(req.query.isActive);
  }
  return services.assetCategoryService.getAll(filter, parseListOptions(req));
});
const update = handle((req) => services.assetCategoryService.updateCategory(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.assetCategoryService.getById(req.params.id),
});
const setActive = handle((req) => services.assetCategoryService.setActive(req.params.id, req.body.isActive), {
  idempotent: true,
  ifMatch: (req) => services.assetCategoryService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.assetCategoryService.deleteCategory(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.assetCategoryService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  getAll,
  update,
  setActive,
  remove,
};
