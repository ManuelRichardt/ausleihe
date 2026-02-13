const menuConfig = require('./menu.config');
const { createPermissionHelper } = require('../helpers/permission.helper');

function isRouteActive(currentPath, route) {
  if (!route) {
    return false;
  }
  if (currentPath === route) {
    return true;
  }
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped}(/|$)`);
  return regex.test(currentPath);
}

function filterItem(item, helper, hasLendingLocation) {
  const scope = item.scope || 'both';
  if (scope === 'ausleihe' && !hasLendingLocation) {
    return null;
  }
  if (scope === 'global' && hasLendingLocation && item.route && item.route.startsWith('/system')) {
    return null;
  }

  const requiredPermissions = Array.isArray(item.permissions) ? item.permissions : [];
  const allowed = requiredPermissions.length === 0 || helper.canAny(requiredPermissions, scope);

  const children = Array.isArray(item.children)
    ? item.children
        .map((child) => filterItem(child, helper, hasLendingLocation))
        .filter(Boolean)
    : [];

  if (!allowed && children.length === 0) {
    return null;
  }

  return {
    ...item,
    children,
  };
}

function sortItems(items) {
  return items
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((item) => ({
      ...item,
      children: item.children ? sortItems(item.children) : [],
    }));
}

function markActive(items, currentPath) {
  return items.map((item) => {
    const children = item.children ? markActive(item.children, currentPath) : [];
    const isActive = isRouteActive(currentPath, item.route) || children.some((c) => c.active || c.open);
    return {
      ...item,
      children,
      active: isRouteActive(currentPath, item.route),
      open: isActive,
    };
  });
}

function buildMenu({ userRoles, lendingLocationId, currentPath }) {
  const helper = createPermissionHelper(userRoles, lendingLocationId);
  const hasLendingLocation = Boolean(lendingLocationId);

  const filtered = menuConfig
    .map((item) => filterItem(item, helper, hasLendingLocation))
    .filter(Boolean);

  const sorted = sortItems(filtered);
  return markActive(sorted, currentPath || '/');
}

function fallbackMenu() {
  return [
    { id: 'home', label: 'Home', route: '/', icon: 'home', permissions: [], scope: 'both', order: 1, active: false, open: false, children: [] },
    { id: 'login', label: 'Login', route: '/login', icon: 'login', permissions: [], scope: 'both', order: 2, active: false, open: false, children: [] },
  ];
}

module.exports = {
  buildMenu,
  fallbackMenu,
};
