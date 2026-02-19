const {
  services,
  renderPage,
  handleError,
  parseListQuery,
  parseIncludeDeleted,
  buildPagination,
} = require('../controllerUtils');
const { ROLE_SCOPE } = require('../../../config/dbConstants');
const { getActorContext } = require('../../../utils/requestContextHelper');

class UserAdminController {
  getRoleScopeMap(roles) {
    const map = new Map();
    (roles || []).forEach((role) => {
      if (role && role.id) {
        map.set(role.id, role.scope || ROLE_SCOPE.GLOBAL);
      }
    });
    return map;
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

  buildRoleSelection(body, lendingLocations) {
    return {
      globalRoleIds: this.buildGlobalRoleIds(body),
      locationRoleMap: this.buildLocationRoleMap(body, lendingLocations),
    };
  }

  validateRoleSelection(roleSelection, roleScopeMap) {
    const { globalRoleIds, locationRoleMap } = roleSelection;
    // Role selection must match role scope; invalid scope combinations are rejected before persistence.
    const hasLocationScopedRoleInGlobalSelector = globalRoleIds.some(
      (roleId) => roleScopeMap.get(roleId) === ROLE_SCOPE.LENDING_LOCATION
    );
    const hasGlobalRoleInLocationSelector = Array.from(locationRoleMap.values()).some(
      (roleId) => roleScopeMap.get(roleId) !== ROLE_SCOPE.LENDING_LOCATION
    );
    return {
      hasLocationScopedRoleInGlobalSelector,
      hasGlobalRoleInLocationSelector,
      hasErrors: hasLocationScopedRoleInGlobalSelector || hasGlobalRoleInLocationSelector,
    };
  }

  buildRoleDiff(existingRoles, roleSelection) {
    const existingGlobalRoleIds = new Set(
      existingRoles.filter((role) => !role.lendingLocationId).map((role) => role.roleId)
    );
    const existingScopedRoles = existingRoles.filter((role) => role.lendingLocationId);
    const desiredScopedRoleKeys = new Set(
      Array.from(roleSelection.locationRoleMap.entries()).map(([locationId, roleId]) => `${locationId}:${roleId}`)
    );

    const rolesToAddGlobal = roleSelection.globalRoleIds.filter((roleId) => !existingGlobalRoleIds.has(roleId));
    const rolesToRemoveGlobal = Array.from(existingGlobalRoleIds).filter(
      (roleId) => !roleSelection.globalRoleIds.includes(roleId)
    );
    const scopedRolesToAdd = Array.from(roleSelection.locationRoleMap.entries())
      .filter(([locationId, roleId]) =>
        !existingScopedRoles.some(
          (existingRole) => existingRole.lendingLocationId === locationId && existingRole.roleId === roleId
        )
      )
      .map(([locationId, roleId]) => ({ lendingLocationId: locationId, roleId }));
    const scopedRolesToRemove = existingScopedRoles.filter((existingRole) => {
      const key = `${existingRole.lendingLocationId}:${existingRole.roleId}`;
      return !desiredScopedRoleKeys.has(key);
    });

    return {
      rolesToAddGlobal,
      rolesToRemoveGlobal,
      scopedRolesToAdd,
      scopedRolesToRemove,
    };
  }

  async applyRoleDiff(userId, roleDiff, actorContext) {
    for (const roleId of roleDiff.rolesToAddGlobal) {
      await services.userService.assignRole({ userId, roleId }, actorContext);
    }
    for (const roleId of roleDiff.rolesToRemoveGlobal) {
      await services.userService.revokeRole(
        { userId, roleId, lendingLocationId: null },
        actorContext
      );
    }
    for (const scopedRole of roleDiff.scopedRolesToAdd) {
      await services.userService.assignRole(
        { userId, roleId: scopedRole.roleId, lendingLocationId: scopedRole.lendingLocationId },
        actorContext
      );
    }
    for (const scopedRole of roleDiff.scopedRolesToRemove) {
      await services.userService.revokeRole(
        {
          userId,
          roleId: scopedRole.roleId,
          lendingLocationId: scopedRole.lendingLocationId,
        },
        actorContext
      );
    }
  }

  async syncRolesForUser(userId, roleSelection, actorContext) {
    const existingRoles = await services.userService.listUserRoles(userId);
    const roleDiff = this.buildRoleDiff(existingRoles, roleSelection);
    // Role sync is diff-based: add missing assignments, then revoke stale assignments.
    await this.applyRoleDiff(userId, roleDiff, actorContext);
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
      const scopedLendingLocationId =
        role.scope === ROLE_SCOPE.LENDING_LOCATION ? (req.body.lendingLocationId || null) : null;
      if (role.scope === ROLE_SCOPE.LENDING_LOCATION && !scopedLendingLocationId) {
        if (typeof req.flash === 'function') {
          req.flash('error', 'Bitte eine Ausleihe auswählen.');
        }
        return res.redirect(`/admin/users/${userId}`);
      }
      await services.userService.assignRole(
        { userId, roleId, lendingLocationId: scopedLendingLocationId || null },
        getActorContext(req)
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
      const roleSelection = this.buildRoleSelection(req.body, lendingLocations);
      const roleValidation = this.validateRoleSelection(roleSelection, roleScopeMap);

      if (roleValidation.hasErrors) {
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

      await this.syncRolesForUser(user.id, roleSelection, getActorContext(req));

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
      const roleSelection = this.buildRoleSelection(req.body, lendingLocations);
      const roleValidation = this.validateRoleSelection(roleSelection, roleScopeMap);

      if (roleValidation.hasErrors) {
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

      await this.syncRolesForUser(userId, roleSelection, getActorContext(req));

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

  getSelectedUserIds(body) {
    return Array.isArray(body.userIds) ? body.userIds : body.userIds ? [body.userIds] : [];
  }

  normalizeBodyArray(value) {
    if (Array.isArray(value)) {
      return value;
    }
    if (value) {
      return [value];
    }
    return [];
  }

  throwOnBulkFailures(failures, prefix) {
    if (!failures.length) {
      return;
    }
    throw new Error(`${prefix}: ${failures[0].message}`);
  }

  collectBulkFailure(failures, userId, err) {
    failures.push({ userId, message: err && err.message ? err.message : 'Unbekannter Fehler' });
  }

  isIgnorableBulkRevokeError(err) {
    return Boolean(err && err.message && err.message.toLowerCase().includes('userrole not found'));
  }

  getRoleAssignmentsForBulk(body) {
    const roleId = body.roleId;
    const lendingLocationId = body.lendingLocationId || null;
    const bulkRoleIds = this.normalizeBodyArray(body.bulkRoleIds);
    const bulkRoleLocationIds = this.normalizeBodyArray(body.bulkRoleLocationIds);

    if (bulkRoleIds.length > 0) {
      return bulkRoleIds
        .map((id, index) => ({
          roleId: id,
          lendingLocationId: bulkRoleLocationIds[index] || null,
        }))
        .filter((assignment) => assignment.roleId);
    }
    if (roleId) {
      return [{ roleId, lendingLocationId: lendingLocationId || null }];
    }
    return [];
  }

  getRoleRemovalsForBulk(body) {
    const roleId = body.roleId;
    const lendingLocationId = body.lendingLocationId || null;
    const removeRoleIds = this.normalizeBodyArray(body.bulkRemoveRoleIds);
    const removeRoleLocationIds = this.normalizeBodyArray(body.bulkRemoveRoleLocationIds);

    if (removeRoleIds.length > 0) {
      return removeRoleIds
        .map((id, index) => ({
          roleId: id,
          lendingLocationId: removeRoleLocationIds[index] || null,
        }))
        .filter((assignment) => assignment.roleId);
    }
    if (roleId) {
      return [{ roleId, lendingLocationId: lendingLocationId || null }];
    }
    return [];
  }

  async handleBulkAssignRole(req, userIds) {
    const assignments = this.getRoleAssignmentsForBulk(req.body);
    if (!assignments.length) {
      throw new Error('Bitte eine Rolle auswählen.');
    }

    const allRoles = await services.roleService.getAll();
    const roleScopeMap = this.getRoleScopeMap(allRoles);
    const invalidAssignment = assignments.find(
      (assignment) =>
        roleScopeMap.get(assignment.roleId) === ROLE_SCOPE.LENDING_LOCATION &&
        !assignment.lendingLocationId
    );
    if (invalidAssignment) {
      throw new Error('Bitte eine Ausleihe auswählen.');
    }

    const failures = [];
    const actorContext = getActorContext(req);
    for (const userId of userIds) {
      try {
        for (const assignment of assignments) {
          const scope = roleScopeMap.get(assignment.roleId);
          await services.userService.assignRole(
            {
              userId,
              roleId: assignment.roleId,
              lendingLocationId: scope === ROLE_SCOPE.LENDING_LOCATION ? (assignment.lendingLocationId || null) : null,
            },
            actorContext
          );
        }
      } catch (err) {
        this.collectBulkFailure(failures, userId, err);
      }
    }
    this.throwOnBulkFailures(failures, 'Rollen-Zuweisung fehlgeschlagen');
  }

  async handleBulkRemoveRole(req, userIds) {
    const removals = this.getRoleRemovalsForBulk(req.body);
    if (!removals.length) {
      throw new Error('Bitte eine Rolle auswählen.');
    }

    const failures = [];
    const actorContext = getActorContext(req);
    for (const userId of userIds) {
      try {
        for (const removal of removals) {
          if (removal.lendingLocationId) {
            await services.userService.revokeRole(
              { userId, roleId: removal.roleId, lendingLocationId: removal.lendingLocationId },
              actorContext
            );
          } else {
            await services.userService.revokeRoleEverywhere(
              { userId, roleId: removal.roleId },
              actorContext
            );
          }
        }
      } catch (err) {
        if (this.isIgnorableBulkRevokeError(err)) {
          continue;
        }
        this.collectBulkFailure(failures, userId, err);
      }
    }
    this.throwOnBulkFailures(failures, 'Rollen-Entfernung fehlgeschlagen');
  }

  async handleBulkDeleteUsers(userIds) {
    const failures = [];
    for (const userId of userIds) {
      try {
        await services.userService.deleteUser(userId);
      } catch (err) {
        this.collectBulkFailure(failures, userId, err);
      }
    }
    this.throwOnBulkFailures(failures, 'Löschen fehlgeschlagen');
  }

  async bulk(req, res, next) {
    try {
      const userIds = this.getSelectedUserIds(req.body);
      const action = req.body.action;

      if (!userIds.length) {
        if (typeof req.flash === 'function') {
          req.flash('error', 'Bitte mindestens einen Benutzer auswählen.');
        }
        return res.redirect('/admin/users');
      }

      const actionHandlers = {
        assign_role: () => this.handleBulkAssignRole(req, userIds),
        remove_role: () => this.handleBulkRemoveRole(req, userIds),
        delete: () => this.handleBulkDeleteUsers(userIds),
      };
      const handler = actionHandlers[action];
      if (!handler) {
        if (typeof req.flash === 'function') {
          req.flash('error', 'Ungültige Bulk-Aktion.');
        }
        return res.redirect('/admin/users');
      }
      await handler();

      if (typeof req.flash === 'function') {
        req.flash('success', 'Bulk-Aktion ausgeführt');
      }
      return res.redirect('/admin/users');
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message || 'Bulk-Aktion fehlgeschlagen');
      }
      return res.redirect('/admin/users');
    }
  }
}

module.exports = UserAdminController;
