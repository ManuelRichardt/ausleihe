const { services, renderPage, handleError, parseIncludeDeleted } = require('../_controllerUtils');

class RoleAdminController {
  parseListQuery(req) {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 5), 100);
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy;
    const sortOrder = (req.query.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const orderable = new Set(['name', 'scope', 'createdAt']);
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
      if (req.query.scope) {
        filter.scope = req.query.scope;
      }
      if (includeDeleted) {
        filter.includeDeleted = true;
      }
      const total = await services.roleService.countRoles(filter);
      const roles = await services.roleService.searchRoles(filter, { limit, offset, order });
      return renderPage(res, 'admin/roles/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Roles', href: '/admin/roles' },
        ],
        roles,
        filters: {
          q: req.query.q || '',
          scope: req.query.scope || '',
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
      const permissions = await services.permissionService.getAll();
      return renderPage(res, 'admin/roles/new', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Roles', href: '/admin/roles' },
          { label: 'New', href: '/admin/roles/new' },
        ],
        permissions,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      const role = await services.roleService.createRole(
        {
          name: req.body.name,
          scope: req.body.scope,
          description: req.body.description,
        },
        { actorId: req.user ? req.user.id : null }
      );

      const permissionIds = Array.isArray(req.body.permissionIds)
        ? req.body.permissionIds
        : req.body.permissionIds
          ? [req.body.permissionIds]
          : [];

      for (const permissionId of permissionIds) {
        await services.roleService.addPermission(role.id, permissionId, { actorId: req.user ? req.user.id : null });
      }

      if (typeof req.flash === 'function') {
        req.flash('success', 'Rolle angelegt');
      }
      return res.redirect('/admin/roles');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const role = await services.roleService.getByIdWithPermissions(req.params.id);
      const permissions = await services.permissionService.getAll();
      return renderPage(res, 'admin/roles/edit', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Roles', href: '/admin/roles' },
          { label: role.name, href: `/admin/roles/${req.params.id}/edit` },
        ],
        role,
        permissions,
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
      const roleId = req.params.id;
      await services.roleService.updateRole(
        roleId,
        {
          name: req.body.name,
          scope: req.body.scope,
          description: req.body.description,
        },
        { actorId: req.user ? req.user.id : null }
      );

      const desiredPermissionIds = Array.isArray(req.body.permissionIds)
        ? req.body.permissionIds
        : req.body.permissionIds
          ? [req.body.permissionIds]
          : [];

      const role = await services.roleService.getByIdWithPermissions(roleId);
      const existingIds = new Set((role.permissions || []).map((p) => p.id));

      for (const permissionId of desiredPermissionIds) {
        if (!existingIds.has(permissionId)) {
          await services.roleService.addPermission(roleId, permissionId, { actorId: req.user ? req.user.id : null });
        }
      }

      for (const permissionId of existingIds) {
        if (!desiredPermissionIds.includes(permissionId)) {
          await services.roleService.removePermission(roleId, permissionId, { actorId: req.user ? req.user.id : null });
        }
      }

      if (typeof req.flash === 'function') {
        req.flash('success', 'Rolle gespeichert');
      }
      return res.redirect(`/admin/roles/${roleId}/edit`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async remove(req, res, next) {
    try {
      await services.roleService.deleteRole(req.params.id, { actorId: req.user ? req.user.id : null });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Rolle gelöscht');
      }
      return res.redirect('/admin/roles');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async restore(req, res, next) {
    try {
      const includeDeleted = parseIncludeDeleted(req) || req.body.includeDeleted === '1';
      const role = await services.roleService.getById(req.params.id, { includeDeleted: true });
      await services.roleService.restoreRole(role.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Rolle wiederhergestellt');
      }
      return res.redirect(includeDeleted ? '/admin/roles?includeDeleted=1' : '/admin/roles');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = RoleAdminController;
