const {
  services,
  renderPage,
  handleError,
  parseListQuery,
  parseIncludeDeleted,
  buildPagination,
} = require('../_controllerUtils');

class UserAdminController {
  getRoleScopeMap(roles) {
    const map = new Map();
    (roles || []).forEach((role) => {
      if (role && role.id) {
        map.set(role.id, role.scope || 'global');
      }
    });
    return map;
  }

  extractRoleAssignments(body, roleScopeMap) {
    const roleIds = Array.isArray(body.roleIds) ? body.roleIds : body.roleIds ? [body.roleIds] : [];
    const assignments = roleIds.map((roleId) => {
      const lendingLocationId = body[`roleLocation_${roleId}`] || null;
      return { roleId, lendingLocationId: lendingLocationId || null };
    });

    const errors = [];
    assignments.forEach((assignment) => {
      const scope = roleScopeMap.get(assignment.roleId);
      if (scope === 'ausleihe' && !assignment.lendingLocationId) {
        errors.push('Für ausleihe-spezifische Rollen muss eine Ausleihe gewählt werden.');
      }
    });

    return { assignments, errors };
  }

  buildGlobalRoleIds(body) {
    return Array.isArray(body.roleIds) ? body.roleIds : body.roleIds ? [body.roleIds] : [];
  }

  buildLocationRoleMap(body, lendingLocations) {
    const map = new Map();
    (lendingLocations || []).forEach((loc) => {
      const key = `locationRole_${loc.id}`;
      const roleId = body[key];
      if (roleId) {
        map.set(loc.id, roleId);
      }
    });
    return map;
  }

  async index(req, res, next) {
    try {
      const { page, limit, offset, order, sortBy, sortOrder } = parseListQuery(
        req,
        ['firstName', 'lastName', 'email', 'username', 'createdAt', 'isActive', 'externalProvider', 'lastLoginAt'],
        { order: [['createdAt', 'DESC']] }
      );
      const filter = {};
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
      if (req.query.externalProvider) {
        filter.externalProvider = req.query.externalProvider;
      }
      if (req.query.externalId) {
        filter.externalId = req.query.externalId;
      }
      if (req.query.lastLoginAtFrom) {
        filter.lastLoginAtFrom = req.query.lastLoginAtFrom;
      }
      if (req.query.lastLoginAtTo) {
        filter.lastLoginAtTo = req.query.lastLoginAtTo;
      }
      if (includeDeleted) {
        filter.includeDeleted = true;
      }

      const total = await services.userService.countUsers(filter);
      const users = await services.userService.getAll(filter, { limit, offset, order });
      const roles = await services.roleService.getAll();
      const lendingLocations = await services.lendingLocationService.getAll();

      return renderPage(res, 'admin/users/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Users', href: '/admin/users' },
        ],
        users,
        roles,
        lendingLocations,
        filters: {
          q: req.query.q || '',
          status: req.query.status || '',
          externalProvider: req.query.externalProvider || '',
          externalId: req.query.externalId || '',
          lastLoginAtFrom: req.query.lastLoginAtFrom || '',
          lastLoginAtTo: req.query.lastLoginAtTo || '',
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
      const user = await services.userService.getById(req.params.id);
      const roles = await services.userService.listUserRoles(req.params.id);
      const allRoles = await services.roleService.getAll();
      const lendingLocations = await services.lendingLocationService.getAll();
      const permissions = await services.permissionService.getAll();
      const handedOver = await services.loanService.getAll({ userId: req.params.id, status: 'handed_over' });
      const overdue = await services.loanService.getAll({ userId: req.params.id, status: 'overdue' });
      const reservations = await services.loanService.getAll({ userId: req.params.id, status: 'reserved' });

      return renderPage(res, 'admin/users/show', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Users', href: '/admin/users' },
          { label: user.username, href: `/admin/users/${req.params.id}` },
        ],
        user,
        roles,
        allRoles,
        lendingLocations,
        permissions,
        loans: [...handedOver, ...overdue],
        reservationsList: reservations,
      });
    } catch (err) {
      if (err && err.message && err.message.toLowerCase().includes('not found')) {
        err.status = 404;
      }
      return handleError(res, next, req, err);
    }
  }

  async assignRoleFromDetail(req, res, next) {
    try {
      const userId = req.params.id;
      const roleId = req.body.roleId;
      if (!roleId) {
        if (typeof req.flash === 'function') {
          req.flash('error', 'Bitte eine Rolle auswählen.');
        }
        return res.redirect(`/admin/users/${userId}`);
      }
      const role = await services.roleService.getById(roleId);
      const lendingLocationId = role.scope === 'ausleihe' ? (req.body.lendingLocationId || null) : null;
      if (role.scope === 'ausleihe' && !lendingLocationId) {
        if (typeof req.flash === 'function') {
          req.flash('error', 'Bitte eine Ausleihe auswählen.');
        }
        return res.redirect(`/admin/users/${userId}`);
      }
      await services.userService.assignRole(
        { userId, roleId, lendingLocationId: lendingLocationId || null },
        { actorId: req.user ? req.user.id : null }
      );
      if (typeof req.flash === 'function') {
        req.flash('success', 'Rolle zugewiesen');
      }
      return res.redirect(`/admin/users/${userId}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async restore(req, res, next) {
    try {
      const includeDeleted = parseIncludeDeleted(req) || req.body.includeDeleted === '1';
      const user = await services.userService.getById(req.params.id, { includeDeleted: true });
      await services.userService.restoreUser(user.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Benutzer wiederhergestellt');
      }
      return res.redirect(includeDeleted ? '/admin/users?includeDeleted=1' : '/admin/users');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async new(req, res, next) {
    try {
      const allRoles = await services.roleService.getAll();
      const lendingLocations = await services.lendingLocationService.getAll();
      return renderPage(res, 'admin/users/new', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Users', href: '/admin/users' },
          { label: 'New', href: '/admin/users/new' },
        ],
        allRoles,
        lendingLocations,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      if (!req.body || !req.body.password) {
        const err = new Error('Password is required');
        err.status = 422;
        throw err;
      }
      const user = await services.userService.createUser({
        username: req.body.username,
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        password: req.body.password,
        isActive: req.body.isActive !== 'false',
      });

      const allRoles = await services.roleService.getAll();
      const lendingLocations = await services.lendingLocationService.getAll();
      const roleScopeMap = this.getRoleScopeMap(allRoles);
      const globalRoleIds = this.buildGlobalRoleIds(req.body);
      const locationRoleMap = this.buildLocationRoleMap(req.body, lendingLocations);

      const invalidGlobal = globalRoleIds.find((roleId) => roleScopeMap.get(roleId) === 'ausleihe');
      const invalidLocation = Array.from(locationRoleMap.values()).find(
        (roleId) => roleScopeMap.get(roleId) !== 'ausleihe'
      );

      if (invalidGlobal || invalidLocation) {
        return renderPage(res, 'admin/users/new', req, {
          breadcrumbs: [
            { label: 'Admin', href: '/admin/assets' },
            { label: 'Users', href: '/admin/users' },
            { label: 'New', href: '/admin/users/new' },
          ],
          allRoles,
          lendingLocations,
          errors: [{ field: 'roleIds', message: 'Ungültige Rollenwahl für Ausleihe oder global.' }],
          formData: req.body,
        });
      }

      for (const roleId of globalRoleIds) {
        await services.userService.assignRole(
          { userId: user.id, roleId },
          { actorId: req.user ? req.user.id : null }
        );
      }

      for (const [locationId, roleId] of locationRoleMap.entries()) {
        await services.userService.assignRole(
          { userId: user.id, roleId, lendingLocationId: locationId },
          { actorId: req.user ? req.user.id : null }
        );
      }

      if (typeof req.flash === 'function') {
        req.flash('success', 'Benutzer angelegt');
      }
      return res.redirect(`/admin/users/${user.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const user = await services.userService.getById(req.params.id);
      const userRoles = await services.userService.listUserRoles(req.params.id);
      const allRoles = await services.roleService.getAll();
      const lendingLocations = await services.lendingLocationService.getAll();
      return renderPage(res, 'admin/users/edit', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Users', href: '/admin/users' },
          { label: user.username, href: `/admin/users/${req.params.id}` },
          { label: 'Edit', href: `/admin/users/${req.params.id}/edit` },
        ],
        user,
        userRoles,
        allRoles,
        lendingLocations,
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
      const userId = req.params.id;
      await services.userService.updateUser(userId, {
        username: req.body.username,
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        isActive: req.body.isActive !== 'false',
      });

      if (req.body.password) {
        await services.userService.setPassword(userId, req.body.password);
      }

      const allRoles = await services.roleService.getAll();
      const lendingLocations = await services.lendingLocationService.getAll();
      const roleScopeMap = this.getRoleScopeMap(allRoles);
      const globalRoleIds = this.buildGlobalRoleIds(req.body);
      const locationRoleMap = this.buildLocationRoleMap(req.body, lendingLocations);

      const invalidGlobal = globalRoleIds.find((roleId) => roleScopeMap.get(roleId) === 'ausleihe');
      const invalidLocation = Array.from(locationRoleMap.values()).find(
        (roleId) => roleScopeMap.get(roleId) !== 'ausleihe'
      );

      if (invalidGlobal || invalidLocation) {
        const user = await services.userService.getById(userId);
        const userRoles = await services.userService.listUserRoles(userId);
        return renderPage(res, 'admin/users/edit', req, {
          breadcrumbs: [
            { label: 'Admin', href: '/admin/assets' },
            { label: 'Users', href: '/admin/users' },
            { label: user.username, href: `/admin/users/${userId}` },
            { label: 'Edit', href: `/admin/users/${userId}/edit` },
          ],
          user,
          userRoles,
          allRoles,
          lendingLocations,
          errors: [{ field: 'roleIds', message: 'Ungültige Rollenwahl für Ausleihe oder global.' }],
          formData: req.body,
        });
      }

      const existingRoles = await services.userService.listUserRoles(userId);
      const existingGlobalRoleIds = new Set(
        existingRoles.filter((role) => !role.lendingLocationId).map((role) => role.roleId)
      );

      for (const roleId of globalRoleIds) {
        if (!existingGlobalRoleIds.has(roleId)) {
          await services.userService.assignRole(
            { userId, roleId },
            { actorId: req.user ? req.user.id : null }
          );
        }
      }

      for (const roleId of existingGlobalRoleIds) {
        if (!globalRoleIds.includes(roleId)) {
          await services.userService.revokeRole(
            { userId, roleId, lendingLocationId: null },
            { actorId: req.user ? req.user.id : null }
          );
        }
      }

      const existingLocationRoles = existingRoles.filter((role) => role.lendingLocationId);
      const desiredLocationKeys = new Set(
        Array.from(locationRoleMap.entries()).map(([locationId, roleId]) => `${locationId}:${roleId}`)
      );

      for (const [locationId, roleId] of locationRoleMap.entries()) {
        const hasRole = existingLocationRoles.some(
          (role) => role.lendingLocationId === locationId && role.roleId === roleId
        );
        if (!hasRole) {
          await services.userService.assignRole(
            { userId, roleId, lendingLocationId: locationId },
            { actorId: req.user ? req.user.id : null }
          );
        }
      }

      for (const role of existingLocationRoles) {
        const key = `${role.lendingLocationId}:${role.roleId}`;
        if (!desiredLocationKeys.has(key)) {
          await services.userService.revokeRole(
            { userId, roleId: role.roleId, lendingLocationId: role.lendingLocationId },
            { actorId: req.user ? req.user.id : null }
          );
        }
      }

      if (typeof req.flash === 'function') {
        req.flash('success', 'Benutzer gespeichert');
      }
      return res.redirect(`/admin/users/${userId}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async remove(req, res, next) {
    try {
      await services.userService.deleteUser(req.params.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Benutzer gelöscht');
      }
      return res.redirect('/admin/users');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async bulk(req, res, next) {
    try {
      const userIds = Array.isArray(req.body.userIds) ? req.body.userIds : req.body.userIds ? [req.body.userIds] : [];
      const action = req.body.action;
      const roleId = req.body.roleId;
      const lendingLocationId = req.body.lendingLocationId || null;
      const bulkRoleIds = Array.isArray(req.body.bulkRoleIds)
        ? req.body.bulkRoleIds
        : req.body.bulkRoleIds
          ? [req.body.bulkRoleIds]
          : [];
      const bulkRoleLocationIds = Array.isArray(req.body.bulkRoleLocationIds)
        ? req.body.bulkRoleLocationIds
        : req.body.bulkRoleLocationIds
          ? [req.body.bulkRoleLocationIds]
          : [];

      if (!userIds.length) {
        if (typeof req.flash === 'function') {
          req.flash('error', 'Bitte mindestens einen Benutzer auswählen.');
        }
        return res.redirect('/admin/users');
      }

      if (action === 'assign_role') {
        const assignments =
          bulkRoleIds.length > 0
            ? bulkRoleIds
                .map((id, index) => ({
                  roleId: id,
                  lendingLocationId: bulkRoleLocationIds[index] || null,
                }))
                .filter((assignment) => assignment.roleId)
            : roleId
              ? [{ roleId, lendingLocationId: lendingLocationId || null }]
              : [];

        if (!assignments.length) {
          if (typeof req.flash === 'function') {
            req.flash('error', 'Bitte eine Rolle auswählen.');
          }
          return res.redirect('/admin/users');
        }
        const allRoles = await services.roleService.getAll();
        const roleScopeMap = this.getRoleScopeMap(allRoles);
        const invalidAssignment = assignments.find(
          (assignment) =>
            roleScopeMap.get(assignment.roleId) === 'ausleihe' && !assignment.lendingLocationId
        );
        if (invalidAssignment) {
          if (typeof req.flash === 'function') {
            req.flash('error', 'Bitte eine Ausleihe auswählen.');
          }
          return res.redirect('/admin/users');
        }
        const failures = [];
        for (const userId of userIds) {
          try {
            for (const assignment of assignments) {
              const scope = roleScopeMap.get(assignment.roleId);
              await services.userService.assignRole(
                {
                  userId,
                  roleId: assignment.roleId,
                  lendingLocationId: scope === 'ausleihe' ? (assignment.lendingLocationId || null) : null,
                },
                { actorId: req.user ? req.user.id : null }
              );
            }
          } catch (err) {
            failures.push({ userId, message: err.message });
          }
        }
        if (failures.length) {
          if (typeof req.flash === 'function') {
            req.flash('error', `Rollen-Zuweisung fehlgeschlagen: ${failures[0].message}`);
          }
          return res.redirect('/admin/users');
        }
      } else if (action === 'remove_role') {
        const removeRoleIds = Array.isArray(req.body.bulkRemoveRoleIds)
          ? req.body.bulkRemoveRoleIds
          : req.body.bulkRemoveRoleIds
            ? [req.body.bulkRemoveRoleIds]
            : [];
        const removeRoleLocationIds = Array.isArray(req.body.bulkRemoveRoleLocationIds)
          ? req.body.bulkRemoveRoleLocationIds
          : req.body.bulkRemoveRoleLocationIds
            ? [req.body.bulkRemoveRoleLocationIds]
            : [];

        const removals =
          removeRoleIds.length > 0
            ? removeRoleIds
                .map((id, index) => ({
                  roleId: id,
                  lendingLocationId: removeRoleLocationIds[index] || null,
                }))
                .filter((assignment) => assignment.roleId)
            : roleId
              ? [{ roleId, lendingLocationId: lendingLocationId || null }]
              : [];

        if (!removals.length) {
          if (typeof req.flash === 'function') {
            req.flash('error', 'Bitte eine Rolle auswählen.');
          }
          return res.redirect('/admin/users');
        }
        const failures = [];
        for (const userId of userIds) {
          try {
            for (const removal of removals) {
              if (removal.lendingLocationId) {
                await services.userService.revokeRole(
                  { userId, roleId: removal.roleId, lendingLocationId: removal.lendingLocationId },
                  { actorId: req.user ? req.user.id : null }
                );
              } else {
                await services.userService.revokeRoleEverywhere(
                  { userId, roleId: removal.roleId },
                  { actorId: req.user ? req.user.id : null }
                );
              }
            }
          } catch (err) {
            if (err && err.message && err.message.toLowerCase().includes('userrole not found')) {
              continue;
            }
            failures.push({ userId, message: err.message });
          }
        }
        if (failures.length) {
          if (typeof req.flash === 'function') {
            req.flash('error', `Rollen-Entfernung fehlgeschlagen: ${failures[0].message}`);
          }
          return res.redirect('/admin/users');
        }
      } else if (action === 'delete') {
        const failures = [];
        for (const userId of userIds) {
          try {
            await services.userService.deleteUser(userId);
          } catch (err) {
            failures.push({ userId, message: err.message });
          }
        }
        if (failures.length) {
          if (typeof req.flash === 'function') {
            req.flash('error', `Löschen fehlgeschlagen: ${failures[0].message}`);
          }
          return res.redirect('/admin/users');
        }
      } else {
        if (typeof req.flash === 'function') {
          req.flash('error', 'Ungültige Bulk-Aktion.');
        }
        return res.redirect('/admin/users');
      }

      if (typeof req.flash === 'function') {
        req.flash('success', 'Bulk-Aktion ausgeführt');
      }
      return res.redirect('/admin/users');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = UserAdminController;
