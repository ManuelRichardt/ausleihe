const {
  services,
  renderPage,
  handleError,
  parseListQuery,
  parseIncludeDeleted,
  buildPagination,
} = require('../controllerUtils');

class ManufacturerAdminController {
  async index(req, res, next) {
    try {
      const { page, limit, offset, order, sortBy, sortOrder } = parseListQuery(
        req,
        ['name', 'createdAt', 'isActive'],
        { order: [['name', 'ASC']] }
      );
      const filter = { lendingLocationId: req.lendingLocationId || undefined };
      const includeDeleted = parseIncludeDeleted(req);
      if (req.query.q) {
        filter.query = req.query.q;
      }
      if (req.query.status === 'active') {
        filter.isActive = true;
      }
      if (req.query.status === 'blocked') {
        filter.isActive = false;
      }
      if (includeDeleted) {
        filter.includeDeleted = true;
      }

      const total = await services.manufacturerService.countManufacturers(filter);
      const manufacturers = await services.manufacturerService.getAll(filter, { limit, offset, order });

      return renderPage(res, 'admin/manufacturers/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Manufacturers', href: '/admin/manufacturers' },
        ],
        manufacturers,
        filters: {
          q: req.query.q || '',
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
      const manufacturer = await services.manufacturerService.getById(req.params.id);
      if (req.lendingLocationId && manufacturer.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('Manufacturer not found');
        err.status = 404;
        throw err;
      }
      return renderPage(res, 'admin/manufacturers/show', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Manufacturers', href: '/admin/manufacturers' },
          { label: manufacturer.name, href: `/admin/manufacturers/${manufacturer.id}` },
        ],
        manufacturer,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async new(req, res, next) {
    try {
      return renderPage(res, 'admin/manufacturers/new', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Manufacturers', href: '/admin/manufacturers' },
          { label: 'New', href: '/admin/manufacturers/new' },
        ],
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      const manufacturer = await services.manufacturerService.createManufacturer({
        lendingLocationId: req.lendingLocationId,
        name: req.body.name,
        website: req.body.website,
        isActive: req.body.isActive !== 'false',
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Hersteller angelegt');
      }
      return res.redirect(`/admin/manufacturers/${manufacturer.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const manufacturer = res.locals.viewData && res.locals.viewData.manufacturer
        ? res.locals.viewData.manufacturer
        : await services.manufacturerService.getById(req.params.id);
      if (req.lendingLocationId && manufacturer.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('Manufacturer not found');
        err.status = 404;
        throw err;
      }
      return renderPage(res, 'admin/manufacturers/edit', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Manufacturers', href: '/admin/manufacturers' },
          { label: manufacturer.name, href: `/admin/manufacturers/${manufacturer.id}` },
          { label: 'Edit', href: `/admin/manufacturers/${manufacturer.id}/edit` },
        ],
        manufacturer,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async update(req, res, next) {
    try {
      const manufacturer = res.locals.viewData && res.locals.viewData.manufacturer
        ? res.locals.viewData.manufacturer
        : await services.manufacturerService.getById(req.params.id);
      if (req.lendingLocationId && manufacturer.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('Manufacturer not found');
        err.status = 404;
        throw err;
      }
      await services.manufacturerService.updateManufacturer(manufacturer.id, {
        name: req.body.name,
        website: req.body.website,
        isActive: req.body.isActive !== 'false',
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Hersteller gespeichert');
      }
      return res.redirect(`/admin/manufacturers/${manufacturer.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async remove(req, res, next) {
    try {
      const manufacturer = await services.manufacturerService.getById(req.params.id);
      if (req.lendingLocationId && manufacturer.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('Manufacturer not found');
        err.status = 404;
        throw err;
      }
      await services.manufacturerService.deleteManufacturer(manufacturer.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Hersteller gelöscht');
      }
      return res.redirect('/admin/manufacturers');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async restore(req, res, next) {
    try {
      const includeDeleted = parseIncludeDeleted(req) || req.body.includeDeleted === '1';
      const manufacturer = await services.manufacturerService.getById(req.params.id, { includeDeleted: true });
      if (req.lendingLocationId && manufacturer.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('Manufacturer not found');
        err.status = 404;
        throw err;
      }
      await services.manufacturerService.restoreManufacturer(manufacturer.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Hersteller wiederhergestellt');
      }
      return res.redirect(includeDeleted ? '/admin/manufacturers?includeDeleted=1' : '/admin/manufacturers');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = ManufacturerAdminController;
