const { services, renderPage, handleError } = require('../_controllerUtils');
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
      await services.reservationPortalService.cancelForAdmin(
        req.params.id,
        req.lendingLocationId,
        req.user.id,
        req.body.note || null
      );
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
