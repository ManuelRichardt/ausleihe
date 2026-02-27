const { services, renderPage, handleError } = require('../controllerUtils');
const { formatDateTime } = require('../../../utils/dateFormat');

class ReservationAdminController {
  async index(req, res, next) {
    try {
      const reservations = await services.reservationPortalService.listForAdmin(req.lendingLocationId, {
        status: req.query.status || 'reserved',
      });
      return renderPage(res, 'reservations/admin/index', req, {
        pageTitle: 'Offene Reservierungen',
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Offene Reservierungen', href: '/admin/reservations' },
        ],
        reservations,
        formatDateTime,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async show(req, res, next) {
    try {
      const reservation = await services.reservationPortalService.getForAdmin(
        req.params.id,
        req.lendingLocationId
      );
      return renderPage(res, 'reservations/admin/show', req, {
        pageTitle: 'Reservierungsdetails',
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Offene Reservierungen', href: '/admin/reservations' },
          { label: 'Details', href: `/admin/reservations/${reservation.id}` },
        ],
        reservation,
        formatDateTime,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async cancel(req, res, next) {
    try {
      const reservation = await services.reservationPortalService.cancelForAdmin(
        req.params.id,
        req.lendingLocationId,
        req.user.id,
        req.body.note || null
      );

      const reservationUser = reservation && reservation.user ? reservation.user : null;
      if (reservationUser && reservationUser.email) {
        try {
          await services.mailService.sendTemplate('reservation_cancelled', {
            userId: reservationUser.id || null,
            email: reservationUser.email,
            locale: req.locale || 'de',
            loanId: reservation.id,
            variables: {
              firstName: reservationUser.firstName || reservationUser.username || '',
              lastName: reservationUser.lastName || '',
              loanId: reservation.id,
              reservedFrom: formatDateTime(reservation.reservedFrom),
              reservedUntil: formatDateTime(reservation.reservedUntil),
              lendingLocation: reservation.lendingLocation ? reservation.lendingLocation.name : '-',
            },
            metadata: {
              loanId: reservation.id,
              type: 'reservation_cancelled',
              actorUserId: req.user && req.user.id ? req.user.id : null,
            },
          });
        } catch (mailErr) {
          if (typeof req.flash === 'function') {
            req.flash('error', 'Storno gespeichert, Benachrichtigung konnte nicht versendet werden.');
          }
        }
      }
      if (typeof req.flash === 'function') {
        req.flash('success', 'Reservierung wurde storniert.');
      }
      return res.redirect('/admin/reservations');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = ReservationAdminController;
