module.exports = function registerInventoryRoutes(routeContext) {
  const {
    router,
    middlewareStacks,
    controllers,
    loaders,
    validations,
    middlewares,
    helpers,
  } = routeContext;

  helpers.registerInventoryCrudRoutes({
    basePath: '/admin/categories',
    controller: controllers.categoryAdminController,
    validationChain: validations.categoryValidation,
    newView: 'admin/categories/new',
    editView: 'admin/categories/edit',
    loadEditData: loaders.loadCategoryEditData,
    createMiddlewares: [middlewares.uploadCategoryImage],
    updateMiddlewares: [middlewares.uploadCategoryImage],
  });

  helpers.registerInventoryCrudRoutes({
    basePath: '/admin/manufacturers',
    controller: controllers.manufacturerAdminController,
    validationChain: validations.manufacturerValidation,
    newView: 'admin/manufacturers/new',
    editView: 'admin/manufacturers/edit',
    loadEditData: loaders.loadManufacturerEditData,
  });

  helpers.registerInventoryCrudRoutes({
    basePath: '/admin/storage-locations',
    controller: controllers.storageLocationAdminController,
    validationChain: validations.storageLocationValidation,
    newView: 'admin/storage-locations/new',
    editView: 'admin/storage-locations/edit',
    loadEditData: loaders.loadStorageLocationEditData,
  });

  router.get(
    '/admin/asset-models',
    ...middlewareStacks.inventory(),
    controllers.assetModelAdminController.index.bind(controllers.assetModelAdminController)
  );
  router.get(
    '/admin/asset-models/new',
    ...middlewareStacks.inventory(),
    loaders.loadAssetModelFormData,
    controllers.assetModelAdminController.new.bind(controllers.assetModelAdminController)
  );
  router.post(
    '/admin/asset-models',
    ...middlewareStacks.inventory(),
    middlewares.setLendingLocation,
    middlewares.uploadAssetModelImages,
    loaders.loadAssetModelFormData,
    validations.assetModelValidation,
    middlewares.validate('admin/models/new'),
    controllers.assetModelAdminController.create.bind(controllers.assetModelAdminController)
  );
  router.get(
    '/admin/asset-models/:id',
    ...middlewareStacks.inventory(),
    controllers.assetModelAdminController.show.bind(controllers.assetModelAdminController)
  );
  router.get(
    '/admin/asset-models/:id/edit',
    ...middlewareStacks.inventory(),
    loaders.loadAssetModelFormData,
    controllers.assetModelAdminController.edit.bind(controllers.assetModelAdminController)
  );
  router.post(
    '/admin/asset-models/:id',
    ...middlewareStacks.inventory(),
    middlewares.setLendingLocation,
    middlewares.uploadAssetModelImages,
    loaders.loadAssetModelFormData,
    validations.assetModelValidation,
    middlewares.validate('admin/models/edit'),
    controllers.assetModelAdminController.update.bind(controllers.assetModelAdminController)
  );
  router.post(
    '/admin/asset-models/:id/delete',
    ...middlewareStacks.inventory(),
    controllers.assetModelAdminController.remove.bind(controllers.assetModelAdminController)
  );
  router.post(
    '/admin/asset-models/:id/restore',
    ...middlewareStacks.inventory(),
    controllers.assetModelAdminController.restore.bind(controllers.assetModelAdminController)
  );
  router.post(
    '/admin/asset-models/:id/stock',
    ...middlewareStacks.inventory(),
    controllers.assetModelAdminController.updateStock.bind(controllers.assetModelAdminController)
  );
  router.post(
    '/admin/asset-models/:id/attachments/:attachmentId',
    ...middlewareStacks.inventory(),
    controllers.assetModelAdminController.updateAttachment.bind(controllers.assetModelAdminController)
  );
  router.post(
    '/admin/asset-models/:id/attachments/:attachmentId/delete',
    ...middlewareStacks.inventory(),
    controllers.assetModelAdminController.removeAttachment.bind(controllers.assetModelAdminController)
  );

  router.get(
    '/admin/assets',
    ...middlewareStacks.inventory(),
    controllers.assetInstanceAdminController.index.bind(controllers.assetInstanceAdminController)
  );
  router.get(
    '/admin/assets/new',
    ...middlewareStacks.inventory(),
    loaders.loadAssetFormData,
    controllers.assetInstanceAdminController.new.bind(controllers.assetInstanceAdminController)
  );
  router.post(
    '/admin/assets',
    ...middlewareStacks.inventory(),
    middlewares.setLendingLocation,
    loaders.loadAssetFormData,
    validations.assetValidation,
    middlewares.validate('admin/assets/new'),
    controllers.assetInstanceAdminController.create.bind(controllers.assetInstanceAdminController)
  );
  router.get(
    '/admin/assets/import',
    ...middlewareStacks.inventory(),
    controllers.assetImportController.renderImportPage.bind(controllers.assetImportController)
  );
  router.post(
    '/admin/assets/import',
    ...middlewareStacks.inventory(),
    controllers.assetImportController.uploadMiddleware,
    controllers.assetImportController.executeImport.bind(controllers.assetImportController)
  );
  router.get(
    '/admin/exports',
    ...middlewareStacks.inventory(),
    controllers.exportAdminController.index.bind(controllers.exportAdminController)
  );
  router.get(
    '/admin/reports',
    ...middlewareStacks.inventory(),
    controllers.reportAdminController.index.bind(controllers.reportAdminController)
  );
  router.get(
    '/admin/reports/inventory.pdf',
    ...middlewareStacks.inventory(),
    controllers.reportAdminController.inventoryPdf.bind(controllers.reportAdminController)
  );
  router.get(
    '/admin/reports/maintenance.pdf',
    ...middlewareStacks.inventory(),
    controllers.reportAdminController.maintenancePdf.bind(controllers.reportAdminController)
  );
  router.get(
    '/admin/reports/labels.pdf',
    ...middlewareStacks.inventory(),
    controllers.reportAdminController.labelsPdf.bind(controllers.reportAdminController)
  );
  router.get(
    '/admin/assets/:id',
    ...middlewareStacks.inventory(),
    controllers.assetInstanceAdminController.show.bind(controllers.assetInstanceAdminController)
  );
  router.get(
    '/admin/assets/:id/edit',
    ...middlewareStacks.inventory(),
    loaders.loadAssetFormData,
    controllers.assetInstanceAdminController.edit.bind(controllers.assetInstanceAdminController)
  );
  router.post(
    '/admin/assets/:id',
    ...middlewareStacks.inventory(),
    middlewares.setLendingLocation,
    loaders.loadAssetFormData,
    validations.assetValidation,
    middlewares.validate('admin/assets/edit'),
    controllers.assetInstanceAdminController.update.bind(controllers.assetInstanceAdminController)
  );
  router.post(
    '/admin/assets/:id/delete',
    ...middlewareStacks.inventory(),
    controllers.assetInstanceAdminController.remove.bind(controllers.assetInstanceAdminController)
  );
  router.post(
    '/admin/assets/:id/restore',
    ...middlewareStacks.inventory(),
    controllers.assetInstanceAdminController.restore.bind(controllers.assetInstanceAdminController)
  );
  router.post(
    '/admin/assets/:id/maintenance/report',
    ...middlewareStacks.inventory(),
    controllers.assetInstanceAdminController.reportMaintenance.bind(controllers.assetInstanceAdminController)
  );
  router.post(
    '/admin/assets/:id/maintenance/:maintenanceId/start',
    ...middlewareStacks.inventory(),
    controllers.assetInstanceAdminController.startMaintenance.bind(controllers.assetInstanceAdminController)
  );
  router.post(
    '/admin/assets/:id/maintenance/:maintenanceId/complete',
    ...middlewareStacks.inventory(),
    controllers.assetInstanceAdminController.completeMaintenance.bind(controllers.assetInstanceAdminController)
  );
};
