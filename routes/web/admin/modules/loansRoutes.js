module.exports = function registerAdminLoanRoutes(routeContext) {
  const {
    router,
    middlewareStacks,
    middlewares,
    permissions,
    controllers,
  } = routeContext;

  // Loan scope must be resolved before permission checks to avoid cross-location access.
  const loanScopePermissionStack = [
    ...middlewareStacks.authenticatedLendingContext(),
    middlewares.resolveLoanScope,
    middlewares.requirePermission('loan.manage', permissions.resolveLoanScope),
  ];
  const withLoanScopePermission = (handler) => [...loanScopePermissionStack, handler];

  router.get(
    '/admin/reservations',
    ...middlewareStacks.loanScopedLocation(),
    controllers.reservationController.index.bind(controllers.reservationController)
  );
  router.get(
    '/admin/reservations/:id',
    ...withLoanScopePermission(controllers.reservationController.show.bind(controllers.reservationController)),
  );
  router.post(
    '/admin/reservations/:id/cancel',
    ...withLoanScopePermission(controllers.reservationController.cancel.bind(controllers.reservationController))
  );

  router.get(
    '/admin/loans',
    ...middlewareStacks.loanScopedLocation(),
    controllers.loanController.index.bind(controllers.loanController)
  );
  router.get(
    '/admin/loans/new',
    ...middlewareStacks.loanScopedLocation(),
    controllers.loanController.new.bind(controllers.loanController)
  );
  router.post(
    '/admin/loans/new',
    ...middlewareStacks.loanScopedLocation(),
    controllers.loanController.create.bind(controllers.loanController)
  );
  router.get(
    '/admin/loans/users/search',
    ...middlewareStacks.loanScopedLocation(),
    controllers.loanController.searchUsers.bind(controllers.loanController)
  );
  router.get(
    '/admin/loans/assets/search',
    ...middlewareStacks.loanScopedLocation(),
    controllers.loanController.searchAssets.bind(controllers.loanController)
  );
  router.get(
    '/admin/loans/assets/codes',
    ...middlewareStacks.loanScopedLocation(),
    controllers.loanController.listAssetCodes.bind(controllers.loanController)
  );
  router.get(
    '/admin/loans/:id',
    ...withLoanScopePermission(controllers.loanController.show.bind(controllers.loanController))
  );
  router.post(
    '/admin/loans/:id/period',
    ...withLoanScopePermission(controllers.loanController.updatePeriod.bind(controllers.loanController))
  );
  router.get(
    '/admin/loans/:id/return',
    ...withLoanScopePermission(controllers.loanController.showReturn.bind(controllers.loanController))
  );
  router.post(
    '/admin/loans/:id/hand-over',
    ...withLoanScopePermission(controllers.loanController.handOver.bind(controllers.loanController))
  );
  router.post(
    '/admin/loans/:id/return',
    ...withLoanScopePermission(controllers.loanController.returnLoan.bind(controllers.loanController))
  );
  router.post(
    '/admin/loans/:id/return-items',
    ...withLoanScopePermission(controllers.loanController.returnItems.bind(controllers.loanController))
  );
  router.post(
    '/admin/loans/:id/items',
    ...withLoanScopePermission(controllers.loanController.addItem.bind(controllers.loanController))
  );
  router.get(
    '/admin/loans/:id/models/search',
    ...withLoanScopePermission(controllers.loanController.searchModels.bind(controllers.loanController))
  );
  router.post(
    '/admin/loans/:id/items/:itemId/model',
    ...withLoanScopePermission(controllers.loanController.updateItemModel.bind(controllers.loanController))
  );
  router.post(
    '/admin/loans/:id/items/:itemId/delete',
    ...withLoanScopePermission(controllers.loanController.removeItem.bind(controllers.loanController))
  );
};
