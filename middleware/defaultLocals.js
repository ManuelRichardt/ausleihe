const { formatTimeHHMM } = require('../utils/timeFormat');

module.exports = function defaultLocals(req, res, next) {
  // Keep these defaults aligned with validation rerenders so templates always receive the same locals shape.
  res.locals.user = res.locals.user || null;
  res.locals.permissions = res.locals.permissions || { list: [], map: {} };
  res.locals.breadcrumbs = res.locals.breadcrumbs || [];
  res.locals.flashMessages = res.locals.flashMessages || {};
  res.locals.lendingLocation = res.locals.lendingLocation || null;
  res.locals.csrfToken = res.locals.csrfToken || '';
  res.locals.formData = res.locals.formData || {};
  res.locals.errors = res.locals.errors || {};
  res.locals.pageTitle = res.locals.pageTitle || 'Ausleihsystem';
  res.locals.navigation = res.locals.navigation || [];
  res.locals.currentUser = res.locals.currentUser || res.locals.user || null;
  res.locals.activeLendingLocation = res.locals.activeLendingLocation || res.locals.lendingLocation || null;
  res.locals.can = res.locals.can || (() => false);
  res.locals.canAny = res.locals.canAny || (() => false);
  res.locals.canAll = res.locals.canAll || (() => false);
  res.locals.formatTimeHHMM = res.locals.formatTimeHHMM || formatTimeHHMM;
  next();
};
