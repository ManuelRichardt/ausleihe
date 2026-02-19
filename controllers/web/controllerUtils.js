const { createServices } = require('../../services');
const models = require('../../models');
const { parseBooleanToken } = require('../../utils/valueParsing');

const services = Object.assign(createServices(), { models });

function extractPermissions(userRoles) {
  const permissions = new Map();
  const roles = Array.isArray(userRoles) ? userRoles : [];
  roles.forEach((userRole) => {
    const role = userRole.role || userRole;
    const perms = role && Array.isArray(role.permissions) ? role.permissions : [];
    perms.forEach((permission) => {
      if (permission && permission.key) {
        permissions.set(permission.key, permission);
      }
    });
  });
  return {
    list: Array.from(permissions.keys()),
    map: Object.fromEntries(permissions.entries()),
  };
}

async function resolveLendingLocation(req) {
  if (!req.lendingLocationId) {
    return null;
  }
  try {
    return await services.lendingLocationService.getById(req.lendingLocationId);
  } catch (err) {
    return null;
  }
}

function parseListQuery(req, allowedSortFields = [], defaults = {}) {
  const page = Math.max(parseInt(req.query.page, 10) || defaults.page || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || defaults.limit || 20, 5), 100);
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || defaults.sortBy || '';
  const sortOrder = (req.query.sortOrder || defaults.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const order = allowedSortFields.includes(sortBy) ? [[sortBy, sortOrder]] : defaults.order || [['createdAt', 'DESC']];
  return { page, limit, offset, order, sortBy, sortOrder };
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    hasNext: page * limit < total,
  };
}

function parseIncludeDeleted(req) {
  // Soft-deleted rows are only loaded when this flag is set (paranoid: false on downstream queries).
  const value = req && req.query ? req.query.includeDeleted : undefined;
  return parseBooleanToken(value, {
    trueTokens: ['1', 'true', 'yes'],
    falseTokens: ['0', 'false', 'no'],
    defaultValue: false,
  });
}

function getFlashMessages(req) {
  if (!req || !req.session || typeof req.flash !== 'function') {
    return {};
  }
  return req.flash();
}

async function buildRenderContext(req, data = {}) {
  const permissions = extractPermissions(req.userRoles || []);
  const lendingLocation = await resolveLendingLocation(req);
  const lendingLocationId =
    (req && req.lendingLocationId) ||
    (lendingLocation && lendingLocation.id) ||
    null;
  return {
    user: req.user || null,
    currentUser: req.user || null,
    permissions,
    lendingLocation,
    lendingLocationId,
    breadcrumbs: data.breadcrumbs || req.breadcrumbs || [],
    flashMessages: getFlashMessages(req),
    ...data,
  };
}

async function renderPage(res, view, req, data = {}) {
  const context = await buildRenderContext(req, data);
  const layout = data.layout || (view.startsWith('auth/') ? 'layout/auth' : 'layout/main');
  return res.render(view, { ...context, layout });
}

async function renderError(res, req, status, message) {
  const context = await buildRenderContext(req, {
    error: message || null,
  });
  const view = status === 403 ? 'errors/error403' : status === 404 ? 'errors/error404' : 'errors/error500';
  return res.status(status).render(view, { ...context, layout: 'layout/main' });
}

async function handleError(res, next, req, err) {
  if (err && (err.name === 'SequelizeUniqueConstraintError' || err.name === 'SequelizeValidationError')) {
    err.status = 422;
  }
  if (err && Array.isArray(err.errors) && err.errors.length) {
    const first = err.errors[0];
    if (first && first.message) {
      err.message = first.message;
    }
  }
  const status = err && (err.status || err.statusCode);
  if (status === 403 || status === 404) {
    return renderError(res, req, status, err.message);
  }
  if (!status || status >= 500) {
    return renderError(res, req, 500, err && err.message);
  }
  return next(err);
}

module.exports = {
  services,
  renderPage,
  renderError,
  handleError,
  parseListQuery,
  parseIncludeDeleted,
  buildPagination,
};
