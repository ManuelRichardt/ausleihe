class AuthzService {
  hasPermission(data) {
    return this.userHasPermission(data);
  }

  userHasPermission(data) {
    const userRoles = Array.isArray(data.userRoles) ? data.userRoles : [];
    const permissionKey = data.permissionKey;
    const lendingLocationId = data.lendingLocationId ? String(data.lendingLocationId) : null;

    if (!permissionKey) {
      throw new Error('permissionKey is required');
    }

    const relevantRoles = userRoles.filter((userRole) => {
      const roleLocationId = userRole && userRole.lendingLocationId ? String(userRole.lendingLocationId) : null;
      if (lendingLocationId) {
        return roleLocationId === lendingLocationId || roleLocationId === null;
      }
      return roleLocationId === null;
    });

    const wantsLocationScope = Boolean(lendingLocationId);

    return relevantRoles.some((userRole) => {
      const role = userRole.role;
      if (!role) {
        return false;
      }
      const roleScopeAllowed = wantsLocationScope
        ? ['ausleihe', 'both', 'global'].includes(role.scope)
        : ['global', 'both'].includes(role.scope);
      if (!roleScopeAllowed) {
        return false;
      }
      const permissions = Array.isArray(role.permissions) ? role.permissions : [];
      return permissions.some((permission) => {
        if (permission.key !== permissionKey) {
          return false;
        }
        if (wantsLocationScope) {
          return ['ausleihe', 'both', 'global'].includes(permission.scope);
        }
        return ['global', 'both'].includes(permission.scope);
      });
    });
  }
}

module.exports = AuthzService;
