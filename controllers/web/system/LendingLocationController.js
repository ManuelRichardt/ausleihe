const { services, renderPage, handleError, parseIncludeDeleted } = require('../_controllerUtils');
const { toPublicUploadUrl, removePublicFileByUrl } = require('../../../helpers/uploadImage.helper');

class LendingLocationController {
  parseListQuery(req) {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 5), 100);
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy;
    const sortOrder = (req.query.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const orderable = new Set(['name', 'contactEmail', 'isActive', 'createdAt']);
    const order = orderable.has(sortBy) ? [[sortBy, sortOrder]] : [['createdAt', 'DESC']];
    return { page, limit, offset, order, sortBy, sortOrder };
  }

  async index(req, res, next) {
    try {
      const { page, limit, offset, order, sortBy, sortOrder } = this.parseListQuery(req);
      const filter = {};
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
      const total = await services.lendingLocationService.countLocations(filter);
      const locations = await services.lendingLocationService.getAll(filter, { limit, offset, order });
      return renderPage(res, 'system/lending-locations/index', req, {
        breadcrumbs: [
          { label: 'System', href: '/system/lending-locations' },
          { label: 'Lending Locations', href: '/system/lending-locations' },
        ],
        locations,
        filters: {
          q: req.query.q || '',
          status: req.query.status || '',
          includeDeleted: includeDeleted ? '1' : '',
          sortBy,
          sortOrder,
        },
        pagination: {
          page,
          limit,
          total,
          hasNext: page * limit < total,
        },
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async new(req, res, next) {
    try {
      return renderPage(res, 'system/lending-locations/new', req, {
        breadcrumbs: [
          { label: 'System', href: '/system/lending-locations' },
          { label: 'New', href: '/system/lending-locations/new' },
        ],
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      let adminUser;
      try {
        adminUser = await services.userService.getById(req.body.adminUserId);
      } catch (err) {
        const notFound = new Error('Administrator nicht gefunden');
        notFound.status = 422;
        throw notFound;
      }

      const uploadedImageUrl = toPublicUploadUrl(req.file, 'lending-locations');
      const location = await services.lendingLocationService.createLocation({
        name: req.body.name,
        description: req.body.description,
        imageUrl: uploadedImageUrl,
        contactEmail: req.body.contactEmail,
        isActive: req.body.isActive !== 'false',
      });
      const adminRoles = await services.roleService.searchRoles({ name: 'Admin', scope: 'ausleihe' });
      if (!adminRoles.length) {
        const missing = new Error('Admin-Rolle (Scope: ausleihe) fehlt');
        missing.status = 422;
        throw missing;
      }
      await services.userService.assignRole(
        {
          userId: adminUser.id,
          roleId: adminRoles[0].id,
          lendingLocationId: location.id,
        },
        { actorId: req.user ? req.user.id : null }
      );
      if (typeof req.flash === 'function') {
        req.flash('success', 'Lending location created');
      }
      return res.redirect('/system/lending-locations');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async show(req, res, next) {
    try {
      const location = await services.lendingLocationService.getById(req.params.id);
      const adminRole = await services.roleService.searchRoles({ name: 'Admin', scope: 'ausleihe' });
      let adminUser = null;
      if (adminRole.length) {
        const userRoles = await services.models.UserRole.findAll({ where: { lendingLocationId: req.params.id } });
        const match = userRoles.find((ur) => ur.roleId === adminRole[0].id);
        if (match) {
          adminUser = await services.userService.getById(match.userId);
        }
      }
      return renderPage(res, 'system/lending-locations/show', req, {
        breadcrumbs: [
          { label: 'System', href: '/system/lending-locations' },
          { label: location.name, href: `/system/lending-locations/${req.params.id}` },
        ],
        location,
        adminUser,
      });
    } catch (err) {
      if (err && err.message && err.message.toLowerCase().includes('not found')) {
        err.status = 404;
      }
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const location = await services.lendingLocationService.getById(req.params.id);
      const adminRole = await services.roleService.searchRoles({ name: 'Admin', scope: 'ausleihe' });
      let adminUser = null;
      if (adminRole.length) {
        const userRoles = await services.models.UserRole.findAll({ where: { lendingLocationId: req.params.id } });
        const match = userRoles.find((ur) => ur.roleId === adminRole[0].id);
        if (match) {
          adminUser = await services.userService.getById(match.userId);
        }
      }
      return renderPage(res, 'system/lending-locations/edit', req, {
        breadcrumbs: [
          { label: 'System', href: '/system/lending-locations' },
          { label: location.name, href: `/system/lending-locations/${req.params.id}` },
          { label: 'Edit', href: `/system/lending-locations/${req.params.id}/edit` },
        ],
        location,
        adminUser,
      });
    } catch (err) {
      if (err && err.message && err.message.toLowerCase().includes('not found')) {
        err.status = 404;
      }
      return handleError(res, next, req, err);
    }
  }

  async update(req, res, next) {
    try {
      const currentLocation = await services.lendingLocationService.getById(req.params.id);
      const removeImage = req.body.removeImage === '1' || req.body.removeImage === 'true';
      const nextImageUrl = toPublicUploadUrl(req.file, 'lending-locations');
      const imageUrl = nextImageUrl || (removeImage ? null : currentLocation.imageUrl || null);
      await services.lendingLocationService.updateLocation(req.params.id, {
        name: req.body.name,
        description: req.body.description,
        imageUrl,
        contactEmail: req.body.contactEmail,
        isActive: req.body.isActive !== 'false',
      });
      if ((nextImageUrl || removeImage) && currentLocation.imageUrl && currentLocation.imageUrl !== imageUrl) {
        removePublicFileByUrl(currentLocation.imageUrl);
      }
      if (req.body.adminUserId) {
        const adminRole = await services.roleService.searchRoles({ name: 'Admin', scope: 'ausleihe' });
        if (!adminRole.length) {
          const err = new Error('Admin-Rolle (Scope: ausleihe) fehlt');
          err.status = 422;
          throw err;
        }
        const existingRoles = await services.models.UserRole.findAll({
          where: { lendingLocationId: req.params.id, roleId: adminRole[0].id },
        });
        for (const role of existingRoles) {
          await services.userService.revokeRole(
            { userId: role.userId, roleId: role.roleId, lendingLocationId: req.params.id },
            { actorId: req.user ? req.user.id : null }
          );
        }
        await services.userService.assignRole(
          {
            userId: req.body.adminUserId,
            roleId: adminRole[0].id,
            lendingLocationId: req.params.id,
          },
          { actorId: req.user ? req.user.id : null }
        );
      }
      if (typeof req.flash === 'function') {
        req.flash('success', 'Lending location updated');
      }
      return res.redirect(`/system/lending-locations/${req.params.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async remove(req, res, next) {
    try {
      await services.lendingLocationService.deleteLocation(req.params.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Lending location deleted');
      }
      return res.redirect('/system/lending-locations');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async restore(req, res, next) {
    try {
      const includeDeleted = parseIncludeDeleted(req) || req.body.includeDeleted === '1';
      const location = await services.lendingLocationService.getById(req.params.id, { includeDeleted: true });
      await services.lendingLocationService.restoreLocation(location.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Lending location wiederhergestellt');
      }
      return res.redirect(includeDeleted ? '/system/lending-locations?includeDeleted=1' : '/system/lending-locations');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = LendingLocationController;
