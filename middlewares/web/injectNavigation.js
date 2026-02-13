const { createServices } = require('../../services');

const services = createServices();

module.exports = function injectNavigation(req, res, next) {
  const userRoles = Array.isArray(req.userRoles) ? req.userRoles : [];

  const can = (permissionKey) =>
    services.authzService.hasPermission({
      userRoles,
      permissionKey,
      lendingLocationId: req.lendingLocationId || null,
    });
  const canAny = (permissionKeys) =>
    Array.isArray(permissionKeys) && permissionKeys.some((key) => can(key));

  const items = [
    { label: 'Dashboard', href: '/dashboard', requiresLogin: true },
    { label: 'Assets', href: '/assets', requiresLogin: true },
    { label: 'Reservations', href: '/reservations/new', requiresLogin: true },
  ];

  if (can('loan.manage')) {
    items.push({ label: 'Loans', href: '/loans', requiresLogin: true });
  }
  if (
    canAny([
      'inventory.manage',
      'openinghours.manage',
      'loan.manage',
      'users.manage',
      'roles.manage',
      'permissions.manage',
      'customfields.manage',
      'audit.view',
      'system.admin',
      'lendinglocations.manage',
    ])
  ) {
    items.push({ label: 'Admin', href: '/admin/users', requiresLogin: true });
  }
  if (canAny(['system.admin', 'customfields.manage', 'audit.view', 'lendinglocations.manage'])) {
    items.push({ label: 'System', href: '/system/lending-locations', requiresLogin: true });
  }

  res.locals.navigation = items.filter((item) => !item.requiresLogin || req.user);
  next();
};
