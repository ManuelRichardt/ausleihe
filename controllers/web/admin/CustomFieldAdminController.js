const { services, renderPage, handleError, parseIncludeDeleted } = require('../_controllerUtils');

class CustomFieldAdminController {
  parseEnumValues(input) {
    if (!input) {
      return null;
    }
    if (Array.isArray(input)) {
      return input;
    }
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) {
        return null;
      }
      try {
        return JSON.parse(trimmed);
      } catch (err) {
        const parseError = new Error('Enum Werte müssen gültiges JSON sein');
        parseError.status = 422;
        throw parseError;
      }
    }
    return null;
  }
  parseListQuery(req) {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 5), 100);
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy;
    const sortOrder = (req.query.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const orderable = new Set(['key', 'label', 'type', 'scope', 'isActive', 'createdAt']);
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
      if (req.query.status === 'active') {
        filter.isActive = true;
      }
      if (req.query.status === 'inactive') {
        filter.isActive = false;
      }
      filter.scope = 'global';
      if (includeDeleted) {
        filter.includeDeleted = true;
      }

      const total = await services.customFieldDefinitionService.countDefinitions(filter);
      const customFields = await services.customFieldDefinitionService.getAll(filter, { limit, offset, order });
      return renderPage(res, 'admin/custom-fields/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Custom Fields', href: '/admin/custom-fields' },
        ],
        customFields,
        filters: {
          q: req.query.q || '',
          status: req.query.status || '',
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
      return renderPage(res, 'admin/custom-fields/new', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Custom Fields', href: '/admin/custom-fields' },
          { label: 'New', href: '/admin/custom-fields/new' },
        ],
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      const payload = {
        scope: 'global',
        key: req.body.key,
        label: req.body.label,
        type: req.body.type,
        enumValues: this.parseEnumValues(req.body.enumValues),
        required: req.body.required === 'on' || req.body.required === 'true',
        defaultValue: req.body.defaultValue || null,
        isActive: req.body.isActive !== 'false',
      };
      await services.customFieldDefinitionService.create(payload);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Custom Field angelegt');
      }
      return res.redirect('/admin/custom-fields');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const customField = await services.customFieldDefinitionService.getById(req.params.id);
      return renderPage(res, 'admin/custom-fields/edit', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Custom Fields', href: '/admin/custom-fields' },
          { label: customField.key, href: `/admin/custom-fields/${req.params.id}/edit` },
        ],
        customField,
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
      const payload = {
        label: req.body.label,
        type: req.body.type,
        enumValues: this.parseEnumValues(req.body.enumValues),
        required: req.body.required === 'on' || req.body.required === 'true',
        defaultValue: req.body.defaultValue || null,
        isActive: req.body.isActive !== 'false',
      };
      await services.customFieldDefinitionService.update(req.params.id, payload);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Custom Field gespeichert');
      }
      return res.redirect('/admin/custom-fields');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async remove(req, res, next) {
    try {
      await services.customFieldDefinitionService.delete(req.params.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Custom Field gelöscht');
      }
      return res.redirect('/admin/custom-fields');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async restore(req, res, next) {
    try {
      const includeDeleted = parseIncludeDeleted(req) || req.body.includeDeleted === '1';
      await services.customFieldDefinitionService.restore(req.params.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Custom Field wiederhergestellt');
      }
      return res.redirect(includeDeleted ? '/admin/custom-fields?includeDeleted=1' : '/admin/custom-fields');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = CustomFieldAdminController;
