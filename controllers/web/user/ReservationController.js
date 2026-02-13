const { services, renderPage, handleError } = require('../_controllerUtils');
const { formatDateTime } = require('../../../utils/dateFormat');

class UserReservationController {
  async index(req, res, next) {
    try {
      const reservations = await services.reservationPortalService.listForUser(req.user.id, {
        status: req.query.status || undefined,
      });
      return renderPage(res, 'reservations/user/index', req, {
        pageTitle: 'Meine Reservierungen',
        breadcrumbs: [{ label: 'Meine Reservierungen', href: '/reservations' }],
        reservations,
        formatDateTime,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async show(req, res, next) {
    try {
      const reservation = await services.reservationPortalService.getForUser(req.params.id, req.user.id);
      return renderPage(res, 'reservations/user/show', req, {
        pageTitle: 'Reservierungsdetails',
        breadcrumbs: [
          { label: 'Meine Reservierungen', href: '/reservations' },
          { label: 'Details', href: `/reservations/${reservation.id}` },
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
      await services.reservationPortalService.cancelForUser(
        req.params.id,
        req.user.id,
        req.body.note || null
      );
      if (typeof req.flash === 'function') {
        req.flash('success', 'Reservierung wurde storniert.');
      }
      return res.redirect('/reservations');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = UserReservationController;
