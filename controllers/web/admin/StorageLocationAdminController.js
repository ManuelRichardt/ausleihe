const {
  services,
  renderPage,
  handleError,
  parseListQuery,
  parseIncludeDeleted,
  buildPagination,
} = require('../controllerUtils');

class StorageLocationAdminController {
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
      if (req.query.status === 'inactive') {
        filter.isActive = false;
      }
      if (includeDeleted) {
        filter.includeDeleted = true;
      }

      const total = await services.storageLocationService.countStorageLocations(filter);
      const storageLocations = await services.storageLocationService.getAll(filter, { limit, offset, order });

      return renderPage(res, 'admin/storage-locations/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Storage Locations', href: '/admin/storage-locations' },
        ],
        storageLocations,
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
      const storageLocation = await services.storageLocationService.getById(req.params.id);
      if (req.lendingLocationId && storageLocation.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('StorageLocation not found');
        err.status = 404;
        throw err;
      }
      return renderPage(res, 'admin/storage-locations/show', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Storage Locations', href: '/admin/storage-locations' },
          { label: storageLocation.name, href: `/admin/storage-locations/${storageLocation.id}` },
        ],
        storageLocation,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async new(req, res, next) {
    try {
      return renderPage(res, 'admin/storage-locations/new', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Storage Locations', href: '/admin/storage-locations' },
          { label: 'New', href: '/admin/storage-locations/new' },
        ],
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      const storageLocation = await services.storageLocationService.createStorageLocation({
        lendingLocationId: req.lendingLocationId,
        name: req.body.name,
        description: req.body.description,
        isActive: req.body.isActive !== 'false',
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Lagerort angelegt');
      }
      return res.redirect(`/admin/storage-locations/${storageLocation.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const storageLocation = res.locals.viewData && res.locals.viewData.storageLocation
        ? res.locals.viewData.storageLocation
        : await services.storageLocationService.getById(req.params.id);
      if (req.lendingLocationId && storageLocation.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('StorageLocation not found');
        err.status = 404;
        throw err;
      }
      return renderPage(res, 'admin/storage-locations/edit', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Storage Locations', href: '/admin/storage-locations' },
          { label: storageLocation.name, href: `/admin/storage-locations/${storageLocation.id}` },
          { label: 'Edit', href: `/admin/storage-locations/${storageLocation.id}/edit` },
        ],
        storageLocation,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async update(req, res, next) {
    try {
      const storageLocation = res.locals.viewData && res.locals.viewData.storageLocation
        ? res.locals.viewData.storageLocation
        : await services.storageLocationService.getById(req.params.id);
      if (req.lendingLocationId && storageLocation.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('StorageLocation not found');
        err.status = 404;
        throw err;
      }
      await services.storageLocationService.updateStorageLocation(storageLocation.id, {
        name: req.body.name,
        description: req.body.description,
        isActive: req.body.isActive !== 'false',
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Lagerort gespeichert');
      }
      return res.redirect(`/admin/storage-locations/${storageLocation.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async remove(req, res, next) {
    try {
      const storageLocation = await services.storageLocationService.getById(req.params.id);
      if (req.lendingLocationId && storageLocation.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('StorageLocation not found');
        err.status = 404;
        throw err;
      }
      await services.storageLocationService.deleteStorageLocation(storageLocation.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Lagerort gelöscht');
      }
      return res.redirect('/admin/storage-locations');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async restore(req, res, next) {
    try {
      const includeDeleted = parseIncludeDeleted(req) || req.body.includeDeleted === '1';
      const storageLocation = await services.storageLocationService.getById(req.params.id, { includeDeleted: true });
      if (req.lendingLocationId && storageLocation.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('StorageLocation not found');
        err.status = 404;
        throw err;
      }
      await services.storageLocationService.restoreStorageLocation(storageLocation.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Lagerort wiederhergestellt');
      }
      return res.redirect(includeDeleted ? '/admin/storage-locations?includeDeleted=1' : '/admin/storage-locations');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = StorageLocationAdminController;
