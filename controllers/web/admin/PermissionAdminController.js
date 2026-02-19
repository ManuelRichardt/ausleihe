const { services, renderPage, handleError } = require('../controllerUtils');

class PermissionAdminController {
  parseListQuery(req) {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 5), 100);
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy;
    const sortOrder = (req.query.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const orderable = new Set(['key', 'scope', 'createdAt']);
    const order = orderable.has(sortBy) ? [[sortBy, sortOrder]] : [['createdAt', 'DESC']];
    return { page, limit, offset, order, sortBy, sortOrder };
  }

  async index(req, res, next) {
    try {
      const { page, limit, offset, order, sortBy, sortOrder } = this.parseListQuery(req);
      const filter = {};
      if (req.query.q) {
        filter.query = req.query.q;
      }
      if (req.query.scope) {
        filter.scope = req.query.scope;
      }
      const total = await services.permissionService.countPermissions(filter);
      const permissions = await services.permissionService.searchPermissions(filter, { limit, offset, order });
      return renderPage(res, 'admin/permissions/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Permissions', href: '/admin/permissions' },
        ],
        permissions,
        filters: {
          q: req.query.q || '',
          scope: req.query.scope || '',
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
      return renderPage(res, 'admin/permissions/new', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Permissions', href: '/admin/permissions' },
          { label: 'New', href: '/admin/permissions/new' },
        ],
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      const permission = await services.permissionService.createPermission(
        {
          key: req.body.key,
          description: req.body.description,
          scope: req.body.scope,
        },
        { actorId: req.user ? req.user.id : null }
      );
      if (typeof req.flash === 'function') {
        req.flash('success', 'Permission angelegt');
      }
      return res.redirect('/admin/permissions');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const permission = await services.permissionService.getById(req.params.id);
      return renderPage(res, 'admin/permissions/edit', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Permissions', href: '/admin/permissions' },
          { label: permission.key, href: `/admin/permissions/${req.params.id}/edit` },
        ],
        permission,
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
      const permissionId = req.params.id;
      await services.permissionService.updatePermission(
        permissionId,
        {
          key: req.body.key,
          description: req.body.description,
          scope: req.body.scope,
        },
        { actorId: req.user ? req.user.id : null }
      );
      if (typeof req.flash === 'function') {
        req.flash('success', 'Permission gespeichert');
      }
      return res.redirect(`/admin/permissions/${permissionId}/edit`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async remove(req, res, next) {
    try {
      await services.permissionService.deletePermission(req.params.id, { actorId: req.user ? req.user.id : null });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Permission gelöscht');
      }
      return res.redirect('/admin/permissions');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = PermissionAdminController;
