const { services, renderPage, handleError } = require('./controllerUtils');

function toDate(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function sortByDateAsc(items, dateField) {
  return (Array.isArray(items) ? items.slice() : []).sort((a, b) => {
    const left = toDate(a && a[dateField]);
    const right = toDate(b && b[dateField]);
    const l = left ? left.getTime() : 0;
    const r = right ? right.getTime() : 0;
    return l - r;
  });
}

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

      const myLoansRaw = userId
        ? await services.loanService.getAll(
          { userId },
          {
            include: [
              { model: services.models.LendingLocation, as: 'lendingLocation' },
              { model: services.models.LoanItem, as: 'loanItems' },
            ],
            order: [['reservedFrom', 'ASC']],
          }
        )
        : [];

      const reservations = sortByDateAsc(
        myLoansRaw.filter((loan) => loan.status === 'reserved'),
        'reservedFrom'
      );
      const activeLoans = sortByDateAsc(
        myLoansRaw.filter((loan) => loan.status === 'handed_over' || loan.status === 'overdue'),
        'reservedUntil'
      );

      let locationOpenReservations = [];
      let locationTodayHandovers = [];
      let locationTodayReturns = [];
      let locationOverdueLoans = [];
      let hasActiveLendingLocation = Boolean(lendingLocationId);

      if (canManage && lendingLocationId) {
        const locationLoans = await services.loanService.getAll(
          { lendingLocationId },
          {
            include: [
              { model: services.models.User, as: 'user' },
              { model: services.models.LendingLocation, as: 'lendingLocation' },
              { model: services.models.LoanItem, as: 'loanItems' },
            ],
            order: [['reservedFrom', 'ASC']],
          }
        );

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        locationOpenReservations = sortByDateAsc(
          locationLoans.filter((loan) => loan.status === 'reserved'),
          'reservedFrom'
        );
        locationTodayHandovers = sortByDateAsc(
          locationOpenReservations.filter((loan) => {
            const reservedFrom = toDate(loan.reservedFrom);
            return reservedFrom && reservedFrom >= todayStart && reservedFrom <= todayEnd;
          }),
          'reservedFrom'
        );
        locationTodayReturns = sortByDateAsc(
          locationLoans.filter((loan) => {
            if (!['handed_over', 'overdue'].includes(loan.status)) {
              return false;
            }
            const reservedUntil = toDate(loan.reservedUntil);
            return reservedUntil && reservedUntil >= todayStart && reservedUntil <= todayEnd;
          }),
          'reservedUntil'
        );
        const overdueByStatus = locationLoans.filter((loan) => loan.status === 'overdue');
        const overdueByDate = locationLoans.filter((loan) => {
          if (loan.status !== 'handed_over') {
            return false;
          }
          const reservedUntil = toDate(loan.reservedUntil);
          return reservedUntil && reservedUntil < now;
        });
        const seen = new Set();
        locationOverdueLoans = sortByDateAsc(
          overdueByStatus
            .concat(overdueByDate)
            .filter((loan) => {
              if (seen.has(loan.id)) {
                return false;
              }
              seen.add(loan.id);
              return true;
            }),
          'reservedUntil'
        );
      } else if (canManage && !lendingLocationId) {
        hasActiveLendingLocation = false;
      }

      return renderPage(res, 'dashboard/index', req, {
        breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }],
        activeLoans,
        reservations,
        canManageLoans: canManage,
        hasActiveLendingLocation,
        locationOpenReservations,
        locationTodayHandovers,
        locationTodayReturns,
        locationOverdueLoans,
        formatDateTime: require('../../utils/dateFormat').formatDateTime,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = DashboardController;
