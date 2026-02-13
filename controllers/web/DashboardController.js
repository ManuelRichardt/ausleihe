const { services, renderPage, handleError } = require('./_controllerUtils');

class DashboardController {
  async index(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const lendingLocationId = req.lendingLocationId || null;
      const canManage = services.authzService.hasPermission({
        userRoles: req.userRoles || [],
        permissionKey: 'loan.manage',
        lendingLocationId,
      });

      const activeLoans = userId
        ? await services.loanService.getAll(
          canManage && lendingLocationId
            ? { lendingLocationId, status: 'handed_over' }
            : { userId, status: 'handed_over' },
          { include: [{ model: services.models.LendingLocation, as: 'lendingLocation' }] }
        )
        : [];
      const reservations = userId
        ? await services.loanService.getAll(
          canManage && lendingLocationId
            ? { lendingLocationId, status: 'reserved' }
            : { userId, status: 'reserved' },
          { include: [{ model: services.models.LendingLocation, as: 'lendingLocation' }] }
        )
        : [];

      return renderPage(res, 'dashboard/index', req, {
        breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }],
        activeLoans,
        reservations,
        formatDateTime: require('../../utils/dateFormat').formatDateTime,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = DashboardController;
