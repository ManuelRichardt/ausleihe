const {
  services,
  renderPage,
  handleError,
  parseListQuery,
  parseIncludeDeleted,
  buildPagination,
} = require('../_controllerUtils');

class OpeningHourAdminController {
  async index(req, res, next) {
    try {
      const { page, limit, offset, order, sortBy, sortOrder } = parseListQuery(
        req,
        ['dayOfWeek', 'createdAt', 'isClosed'],
        { order: [['dayOfWeek', 'ASC']] }
      );
      const filter = { lendingLocationId: req.lendingLocationId || undefined, isSpecial: false };
      const includeDeleted = parseIncludeDeleted(req);
      if (req.query.dayOfWeek) {
        filter.dayOfWeek = req.query.dayOfWeek;
      }
      if (req.query.status === 'open') {
        filter.isClosed = false;
      }
      if (req.query.status === 'closed') {
        filter.isClosed = true;
      }
      if (includeDeleted) {
        filter.includeDeleted = true;
      }

      const total = await services.openingHourService.countOpeningHours(filter);
      const hours = await services.openingHourService.getAll(filter, { limit, offset, order });

      return renderPage(res, 'admin/opening-hours/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Opening Hours', href: '/admin/opening-hours' },
        ],
        hours,
        filters: {
          dayOfWeek: req.query.dayOfWeek || '',
          status: req.query.status || '',
          includeDeleted: includeDeleted ? '1' : '',
          sortBy,
          sortOrder,
        },
        pagination: buildPagination(page, limit, total),
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async show(req, res, next) {
    try {
      const hour = await services.openingHourService.getById(req.params.id);
      if (req.lendingLocationId && hour.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('OpeningHour not found');
        err.status = 404;
        throw err;
      }
      return renderPage(res, 'admin/opening-hours/show', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Opening Hours', href: '/admin/opening-hours' },
          { label: hour.dayOfWeek, href: `/admin/opening-hours/${hour.id}` },
        ],
        hour,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async new(req, res, next) {
    try {
      return renderPage(res, 'admin/opening-hours/new', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Opening Hours', href: '/admin/opening-hours' },
          { label: 'New', href: '/admin/opening-hours/new' },
        ],
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      const hour = await services.openingHourService.createOpeningHour({
        lendingLocationId: req.lendingLocationId,
        dayOfWeek: req.body.dayOfWeek,
        openTime: req.body.openTime,
        closeTime: req.body.closeTime,
        pickupOpenTime: req.body.pickupOpenTime,
        pickupCloseTime: req.body.pickupCloseTime,
        returnOpenTime: req.body.returnOpenTime,
        returnCloseTime: req.body.returnCloseTime,
        isClosed: req.body.isClosed === 'true',
        validFrom: req.body.validFrom,
        validTo: req.body.validTo,
        isSpecial: false,
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Öffnungszeit angelegt');
      }
      return res.redirect(`/admin/opening-hours/${hour.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const hour = res.locals.viewData && res.locals.viewData.hour
        ? res.locals.viewData.hour
        : await services.openingHourService.getById(req.params.id);
      if (req.lendingLocationId && hour.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('OpeningHour not found');
        err.status = 404;
        throw err;
      }
      return renderPage(res, 'admin/opening-hours/edit', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Opening Hours', href: '/admin/opening-hours' },
          { label: hour.dayOfWeek, href: `/admin/opening-hours/${hour.id}` },
          { label: 'Edit', href: `/admin/opening-hours/${hour.id}/edit` },
        ],
        hour,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async update(req, res, next) {
    try {
      const hour = res.locals.viewData && res.locals.viewData.hour
        ? res.locals.viewData.hour
        : await services.openingHourService.getById(req.params.id);
      if (req.lendingLocationId && hour.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('OpeningHour not found');
        err.status = 404;
        throw err;
      }
      await services.openingHourService.updateOpeningHour(hour.id, {
        dayOfWeek: req.body.dayOfWeek,
        openTime: req.body.openTime,
        closeTime: req.body.closeTime,
        pickupOpenTime: req.body.pickupOpenTime,
        pickupCloseTime: req.body.pickupCloseTime,
        returnOpenTime: req.body.returnOpenTime,
        returnCloseTime: req.body.returnCloseTime,
        isClosed: req.body.isClosed === 'true',
        validFrom: req.body.validFrom,
        validTo: req.body.validTo,
        isSpecial: false,
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Öffnungszeit gespeichert');
      }
      return res.redirect(`/admin/opening-hours/${hour.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async remove(req, res, next) {
    try {
      const hour = await services.openingHourService.getById(req.params.id);
      if (req.lendingLocationId && hour.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('OpeningHour not found');
        err.status = 404;
        throw err;
      }
      await services.openingHourService.deleteOpeningHour(hour.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Öffnungszeit gelöscht');
      }
      return res.redirect('/admin/opening-hours');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async restore(req, res, next) {
    try {
      const includeDeleted = parseIncludeDeleted(req) || req.body.includeDeleted === '1';
      const hour = await services.openingHourService.getById(req.params.id, { includeDeleted: true });
      if (req.lendingLocationId && hour.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('OpeningHour not found');
        err.status = 404;
        throw err;
      }
      await services.openingHourService.restoreOpeningHour(hour.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Öffnungszeit wiederhergestellt');
      }
      return res.redirect(includeDeleted ? '/admin/opening-hours?includeDeleted=1' : '/admin/opening-hours');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = OpeningHourAdminController;
