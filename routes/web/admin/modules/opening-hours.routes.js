module.exports = function registerOpeningHourRoutes(routeContext) {
  const {
    router,
    middlewareStacks,
    middlewares,
    validations,
    controllers,
    loaders,
    permissions,
    helpers,
  } = routeContext;

  router.get(
    '/admin/opening-hours',
    ...middlewareStacks.openingHours(),
    controllers.openingHourAdminController.index.bind(controllers.openingHourAdminController)
  );
  router.get(
    '/admin/opening-hours/new',
    ...middlewareStacks.openingHours(),
    controllers.openingHourAdminController.new.bind(controllers.openingHourAdminController)
  );
  router.post(
    '/admin/opening-hours',
    ...middlewareStacks.openingHours(),
    validations.openingHoursValidation,
    middlewares.validate('admin/opening-hours/new'),
    controllers.openingHourAdminController.create.bind(controllers.openingHourAdminController)
  );
  router.get(
    `/admin/opening-hours/${helpers.OPENING_HOUR_ID_PARAM}`,
    ...middlewareStacks.authenticatedLendingContext(),
    middlewares.requirePermission('openinghours.manage', permissions.resolveOpeningHourScope),
    controllers.openingHourAdminController.show.bind(controllers.openingHourAdminController)
  );
  router.get(
    `/admin/opening-hours/${helpers.OPENING_HOUR_ID_PARAM}/edit`,
    ...middlewareStacks.authenticatedLendingContext(),
    middlewares.requirePermission('openinghours.manage', permissions.resolveOpeningHourScope),
    loaders.loadOpeningHourEditData,
    controllers.openingHourAdminController.edit.bind(controllers.openingHourAdminController)
  );
  router.post(
    `/admin/opening-hours/${helpers.OPENING_HOUR_ID_PARAM}`,
    ...middlewareStacks.authenticatedLendingContext(),
    middlewares.requirePermission('openinghours.manage', permissions.resolveOpeningHourScope),
    loaders.loadOpeningHourEditData,
    validations.openingHoursValidation,
    middlewares.validate('admin/opening-hours/edit'),
    controllers.openingHourAdminController.update.bind(controllers.openingHourAdminController)
  );
  router.post(
    `/admin/opening-hours/${helpers.OPENING_HOUR_ID_PARAM}/delete`,
    ...middlewareStacks.authenticatedLendingContext(),
    middlewares.requirePermission('openinghours.manage', permissions.resolveOpeningHourScope),
    controllers.openingHourAdminController.remove.bind(controllers.openingHourAdminController)
  );
  router.post(
    `/admin/opening-hours/${helpers.OPENING_HOUR_ID_PARAM}/restore`,
    ...middlewareStacks.authenticatedLendingContext(),
    middlewares.requirePermission('openinghours.manage', permissions.resolveOpeningHourScope),
    controllers.openingHourAdminController.restore.bind(controllers.openingHourAdminController)
  );
  router.get(
    '/admin/opening-hours/exceptions/new',
    ...middlewareStacks.openingHours(),
    controllers.openingHourAdminController.newException.bind(controllers.openingHourAdminController)
  );
  router.post(
    '/admin/opening-hours/exceptions',
    ...middlewareStacks.openingHours(),
    validations.openingExceptionValidation,
    middlewares.validate('admin/opening-hours/exceptions/new'),
    controllers.openingHourAdminController.createException.bind(controllers.openingHourAdminController)
  );
  router.get(
    '/admin/opening-hours/exceptions/:id',
    ...middlewareStacks.authenticatedLendingContext(),
    middlewares.requirePermission('openinghours.manage', permissions.resolveOpeningExceptionScope),
    controllers.openingHourAdminController.showException.bind(controllers.openingHourAdminController)
  );
  router.get(
    '/admin/opening-hours/exceptions/:id/edit',
    ...middlewareStacks.authenticatedLendingContext(),
    middlewares.requirePermission('openinghours.manage', permissions.resolveOpeningExceptionScope),
    loaders.loadOpeningExceptionEditData,
    controllers.openingHourAdminController.editException.bind(controllers.openingHourAdminController)
  );
  router.post(
    '/admin/opening-hours/exceptions/:id',
    ...middlewareStacks.authenticatedLendingContext(),
    middlewares.requirePermission('openinghours.manage', permissions.resolveOpeningExceptionScope),
    loaders.loadOpeningExceptionEditData,
    validations.openingExceptionValidation,
    middlewares.validate('admin/opening-hours/exceptions/edit'),
    controllers.openingHourAdminController.updateException.bind(controllers.openingHourAdminController)
  );
  router.post(
    '/admin/opening-hours/exceptions/:id/delete',
    ...middlewareStacks.authenticatedLendingContext(),
    middlewares.requirePermission('openinghours.manage', permissions.resolveOpeningExceptionScope),
    controllers.openingHourAdminController.removeException.bind(controllers.openingHourAdminController)
  );
  router.post(
    '/admin/opening-hours/exceptions/:id/restore',
    ...middlewareStacks.authenticatedLendingContext(),
    middlewares.requirePermission('openinghours.manage', permissions.resolveOpeningExceptionScope),
    controllers.openingHourAdminController.restoreException.bind(controllers.openingHourAdminController)
  );
};
