const {
  services,
  renderPage,
  handleError,
  parseListQuery,
  parseIncludeDeleted,
  buildPagination,
} = require('../_controllerUtils');
const { assertOwnedByLendingLocation } = require('../../../helpers/lendingLocationGuard.helper');

function normalizeTab(tab) {
  const allowed = new Set(['regular', 'special', 'exceptions']);
  return allowed.has(tab) ? tab : 'regular';
}

function normalizeScope(scope, activeTab) {
  if (scope === 'all') {
    return 'all';
  }
  if (scope === 'special') {
    return 'special';
  }
  if (scope === 'regular') {
    return 'regular';
  }
  return activeTab === 'special' ? 'special' : 'regular';
}

class OpeningHourAdminController {
  assertOpeningHourOwnership(openingHour, lendingLocationId) {
    assertOwnedByLendingLocation(openingHour, lendingLocationId, 'OpeningHour');
  }

  assertOpeningExceptionOwnership(openingException, lendingLocationId) {
    assertOwnedByLendingLocation(openingException, lendingLocationId, 'OpeningException');
  }

  buildOpeningHourPayload(req) {
    return {
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
      isSpecial: req.body.isSpecial === 'true',
    };
  }

  buildOpeningExceptionPayload(req) {
    return {
      lendingLocationId: req.lendingLocationId,
      dateFrom: req.body.dateFrom || req.body.date,
      dateTo: req.body.dateTo,
      openTime: req.body.openTime,
      closeTime: req.body.closeTime,
      pickupOpenTime: req.body.pickupOpenTime,
      pickupCloseTime: req.body.pickupCloseTime,
      returnOpenTime: req.body.returnOpenTime,
      returnCloseTime: req.body.returnCloseTime,
      isClosed: req.body.isClosed === 'true',
      reason: req.body.reason || null,
    };
  }

  async index(req, res, next) {
    try {
      const activeTab = normalizeTab(req.query.tab);
      const includeDeleted = parseIncludeDeleted(req);
      // Tab selection controls dataset and pagination source; keep exceptions and regular hours isolated.

      if (activeTab === 'exceptions') {
        return this.renderExceptionsIndex(req, res, next, { includeDeleted, activeTab });
      }

      const scopeFilter = normalizeScope(req.query.scope, activeTab);
      const { page, limit, offset, order, sortBy, sortOrder } = parseListQuery(
        req,
        ['dayOfWeek', 'createdAt', 'isClosed', 'isSpecial'],
        { order: [['dayOfWeek', 'ASC']] }
      );
      const filter = { lendingLocationId: req.lendingLocationId || undefined };
      if (scopeFilter === 'regular') {
        filter.isSpecial = false;
      } else if (scopeFilter === 'special') {
        filter.isSpecial = true;
      }
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
        activeTab,
        scopeFilter,
        hours,
        exceptions: [],
        filters: {
          dayOfWeek: req.query.dayOfWeek || '',
          status: req.query.status || '',
          includeDeleted: includeDeleted ? '1' : '',
          sortBy,
          sortOrder,
          tab: activeTab,
          scope: scopeFilter,
        },
        pagination: buildPagination(page, limit, total),
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async renderExceptionsIndex(req, res, next, ctx = {}) {
    try {
      const includeDeleted = ctx.includeDeleted !== undefined ? ctx.includeDeleted : parseIncludeDeleted(req);
      const activeTab = ctx.activeTab || 'exceptions';
      const { page, limit, offset, order, sortBy, sortOrder } = parseListQuery(
        req,
        ['date', 'createdAt', 'isClosed'],
        { order: [['date', 'ASC']] }
      );
      const filter = { lendingLocationId: req.lendingLocationId || undefined };
      if (req.query.q) {
        filter.query = req.query.q;
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
      const total = await services.openingExceptionService.countExceptions(filter);
      const exceptions = await services.openingExceptionService.getAll(filter, { limit, offset, order });
      return renderPage(res, 'admin/opening-hours/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Opening Hours', href: '/admin/opening-hours' },
        ],
        activeTab,
        scopeFilter: 'all',
        hours: [],
        exceptions,
        filters: {
          q: req.query.q || '',
          status: req.query.status || '',
          includeDeleted: includeDeleted ? '1' : '',
          sortBy,
          sortOrder,
          tab: activeTab,
        },
        pagination: buildPagination(page, limit, total),
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async show(req, res, next) {
    try {
      const openingHour = await services.openingHourService.getById(req.params.id);
      this.assertOpeningHourOwnership(openingHour, req.lendingLocationId);
      return renderPage(res, 'admin/opening-hours/show', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Opening Hours', href: '/admin/opening-hours' },
          { label: openingHour.dayOfWeek, href: `/admin/opening-hours/${openingHour.id}` },
        ],
        hour: openingHour,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async new(req, res, next) {
    try {
      const isSpecial = req.query.isSpecial === '1' || req.query.isSpecial === 'true';
      return renderPage(res, 'admin/opening-hours/new', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Opening Hours', href: '/admin/opening-hours' },
          { label: 'New', href: '/admin/opening-hours/new' },
        ],
        isSpecial,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      const openingHour = await services.openingHourService.createOpeningHour(this.buildOpeningHourPayload(req));
      if (typeof req.flash === 'function') {
        req.flash('success', 'Öffnungszeit angelegt');
      }
      return res.redirect(`/admin/opening-hours/${openingHour.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const openingHour = res.locals.viewData && res.locals.viewData.hour
        ? res.locals.viewData.hour
        : await services.openingHourService.getById(req.params.id);
      this.assertOpeningHourOwnership(openingHour, req.lendingLocationId);
      return renderPage(res, 'admin/opening-hours/edit', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Opening Hours', href: '/admin/opening-hours' },
          { label: openingHour.dayOfWeek, href: `/admin/opening-hours/${openingHour.id}` },
          { label: 'Edit', href: `/admin/opening-hours/${openingHour.id}/edit` },
        ],
        hour: openingHour,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async update(req, res, next) {
    try {
      const openingHour = res.locals.viewData && res.locals.viewData.hour
        ? res.locals.viewData.hour
        : await services.openingHourService.getById(req.params.id);
      this.assertOpeningHourOwnership(openingHour, req.lendingLocationId);
      await services.openingHourService.updateOpeningHour(openingHour.id, this.buildOpeningHourPayload(req));
      if (typeof req.flash === 'function') {
        req.flash('success', 'Öffnungszeit gespeichert');
      }
      return res.redirect(`/admin/opening-hours/${openingHour.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async remove(req, res, next) {
    try {
      const openingHour = await services.openingHourService.getById(req.params.id);
      this.assertOpeningHourOwnership(openingHour, req.lendingLocationId);
      await services.openingHourService.deleteOpeningHour(openingHour.id);
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
      const openingHour = await services.openingHourService.getById(req.params.id, { includeDeleted: true });
      this.assertOpeningHourOwnership(openingHour, req.lendingLocationId);
      await services.openingHourService.restoreOpeningHour(openingHour.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Öffnungszeit wiederhergestellt');
      }
      return res.redirect(includeDeleted ? '/admin/opening-hours?includeDeleted=1' : '/admin/opening-hours');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async newException(req, res, next) {
    try {
      return renderPage(res, 'admin/opening-hours/exceptions/new', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Opening Hours', href: '/admin/opening-hours?tab=exceptions' },
          { label: 'New Exception', href: '/admin/opening-hours/exceptions/new' },
        ],
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async createException(req, res, next) {
    try {
      await services.openingExceptionService.createException(this.buildOpeningExceptionPayload(req));
      if (typeof req.flash === 'function') {
        req.flash('success', 'Ausnahme angelegt');
      }
      return res.redirect('/admin/opening-hours?tab=exceptions');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async showException(req, res, next) {
    try {
      const exception = await services.openingExceptionService.getById(req.params.id);
      this.assertOpeningExceptionOwnership(exception, req.lendingLocationId);
      return renderPage(res, 'admin/opening-hours/exceptions/show', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Opening Hours', href: '/admin/opening-hours?tab=exceptions' },
          { label: exception.date, href: `/admin/opening-hours/exceptions/${exception.id}` },
        ],
        exception,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async editException(req, res, next) {
    try {
      const exception = res.locals.viewData && res.locals.viewData.exception
        ? res.locals.viewData.exception
        : await services.openingExceptionService.getById(req.params.id);
      this.assertOpeningExceptionOwnership(exception, req.lendingLocationId);
      return renderPage(res, 'admin/opening-hours/exceptions/edit', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Opening Hours', href: '/admin/opening-hours?tab=exceptions' },
          { label: exception.date, href: `/admin/opening-hours/exceptions/${exception.id}` },
          { label: 'Edit', href: `/admin/opening-hours/exceptions/${exception.id}/edit` },
        ],
        exception,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async updateException(req, res, next) {
    try {
      const exception = res.locals.viewData && res.locals.viewData.exception
        ? res.locals.viewData.exception
        : await services.openingExceptionService.getById(req.params.id);
      this.assertOpeningExceptionOwnership(exception, req.lendingLocationId);
      const updatedException = await services.openingExceptionService.updateException(
        exception.id,
        this.buildOpeningExceptionPayload(req)
      );
      if (typeof req.flash === 'function') {
        req.flash('success', 'Ausnahme gespeichert');
      }
      return res.redirect(`/admin/opening-hours/exceptions/${updatedException.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async removeException(req, res, next) {
    try {
      const exception = await services.openingExceptionService.getById(req.params.id);
      this.assertOpeningExceptionOwnership(exception, req.lendingLocationId);
      await services.openingExceptionService.deleteException(exception.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Ausnahme gelöscht');
      }
      return res.redirect('/admin/opening-hours?tab=exceptions');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async restoreException(req, res, next) {
    try {
      const includeDeleted = parseIncludeDeleted(req) || req.body.includeDeleted === '1';
      const exception = await services.openingExceptionService.getById(req.params.id, { includeDeleted: true });
      this.assertOpeningExceptionOwnership(exception, req.lendingLocationId);
      await services.openingExceptionService.restoreException(exception.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Ausnahme wiederhergestellt');
      }
      const query = includeDeleted ? '?tab=exceptions&includeDeleted=1' : '?tab=exceptions';
      return res.redirect(`/admin/opening-hours${query}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = OpeningHourAdminController;
