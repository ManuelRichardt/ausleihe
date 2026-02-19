const AuthzService = require('../services/AuthzService');

const authz = new AuthzService();

function normalizeScope(scope) {
  if (!scope) {
    return 'both';
  }
  return scope;
}

function resolveScopeLendingLocation(scope, lendingLocationId) {
  if (scope === 'global') {
    return null;
  }
  if (scope === 'ausleihe') {
    return lendingLocationId || null;
  }
  return lendingLocationId || null;
}

function createPermissionHelper(userRoles, lendingLocationId) {
  const roles = Array.isArray(userRoles) ? userRoles : [];

  function can(permissionKey, scope = 'both') {
    const lendingContext = resolveScopeLendingLocation(normalizeScope(scope), lendingLocationId);
    return authz.hasPermission({
      userRoles: roles,
      permissionKey,
      lendingLocationId: lendingContext,
    });
  }

  function canAny(permissionKeys, scope = 'both') {
    if (!Array.isArray(permissionKeys) || permissionKeys.length === 0) {
      return false;
    }
    return permissionKeys.some((key) => can(key, scope));
  }

  function canAll(permissionKeys, scope = 'both') {
    if (!Array.isArray(permissionKeys) || permissionKeys.length === 0) {
      return false;
    }
    return permissionKeys.every((key) => can(key, scope));
  }

  return { can, canAny, canAll };
}

module.exports = {
  createPermissionHelper,
};
