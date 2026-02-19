const { validationResult } = require('express-validator');

function formatErrors(errors) {
  return errors.map((err) => ({
    field: err.param || err.path || 'form',
    message: err.msg,
  }));
}

function mapErrors(errors) {
  return errors.reduce((acc, err) => {
    acc[err.field] = err.message;
    return acc;
  }, {});
}

function validate(view) {
  return (req, res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) {
      return next();
    }

    const formatted = formatErrors(result.array({ onlyFirstError: true }));
    const errors = mapErrors(formatted);

    res.locals.errors = errors;
    res.locals.formData = req.body || {};

    if (!view) {
      const err = new Error('Validation failed');
      err.status = 422;
      err.details = formatted;
      return next(err);
    }

    res.status(422);
    const isAuthLayout = view.startsWith('auth/');
    const isLanding = view === 'landing';
    return res.render(view, {
      layout: isAuthLayout ? 'layout/auth' : 'layout/main',
      errors,
      formData: req.body || {},
      flashMessages: res.locals.flashMessages || {},
      user: res.locals.user || null,
      currentUser: res.locals.currentUser || res.locals.user || null,
      permissions: res.locals.permissions || { list: [], map: {} },
      lendingLocation: res.locals.lendingLocation || null,
      breadcrumbs: res.locals.breadcrumbs || [],
      csrfToken: res.locals.csrfToken || '',
      showHeader: !isLanding,
      showSidebar: !isLanding,
      ...(res.locals.viewData || {}),
    });
  };
}

module.exports = validate;
