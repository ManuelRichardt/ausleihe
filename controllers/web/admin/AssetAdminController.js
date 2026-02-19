const { services, renderPage, handleError } = require('../controllerUtils');

class AssetAdminController {
  async assets(req, res, next) {
    try {
      const assets = await services.assetInstanceService.getAll({
        lendingLocationId: req.lendingLocationId || undefined,
      });
      const manufacturers = await services.manufacturerService.getAll({ isActive: true });
      return renderPage(res, 'admin/assets/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Assets', href: '/admin/assets' },
        ],
        assets,
        manufacturers,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async models(req, res, next) {
    try {
      const models = await services.assetModelService.getAll({ isActive: true });
      const manufacturers = await services.manufacturerService.getAll({ isActive: true });
      const categories = await services.assetCategoryService.getAll({ isActive: true });
      return renderPage(res, 'admin/models/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Models', href: '/admin/asset-models' },
        ],
        models,
        manufacturers,
        categories,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async customFields(req, res, next) {
    try {
      const customFields = await services.customFieldDefinitionService.getByLendingLocation(
        req.lendingLocationId
      );
      const assetModels = await services.assetModelService.getAll({ isActive: true });
      return renderPage(res, 'admin/custom-fields/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Custom Fields', href: '/admin/custom-fields' },
        ],
        customFields,
        assetModels,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = AssetAdminController;
