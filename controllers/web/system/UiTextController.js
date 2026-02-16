const { services, renderPage, handleError, parseListQuery, buildPagination } = require('../_controllerUtils');

class UiTextController {
  async index(req, res, next) {
    try {
      const { page, limit, offset, order, sortBy, sortOrder } = parseListQuery(
        req,
        ['key', 'updatedAt', 'createdAt', 'isActive'],
        { order: [['key', 'ASC']] }
      );
      const filter = {
        query: req.query.q || '',
      };
      const total = await services.uiTextService.count(filter);
      const entries = await services.uiTextService.list(filter, {
        limit,
        offset,
        order,
      });
      return renderPage(res, 'system/ui-texts/index', req, {
        breadcrumbs: [
          { label: 'System', href: '/system/lending-locations' },
          { label: 'UI Texte', href: '/system/ui-texts' },
        ],
        entries,
        filters: {
          q: req.query.q || '',
          sortBy,
          sortOrder,
        },
        pagination: buildPagination(page, limit, total),
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      await services.uiTextService.create({
        key: req.body.key,
        de: req.body.de,
        en: req.body.en,
        isActive: req.body.isActive !== 'false',
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'UI Text angelegt');
      }
      return res.redirect('/system/ui-texts');
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message || 'UI Text konnte nicht angelegt werden');
      }
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const entry = await services.uiTextService.getById(req.params.id);
      return renderPage(res, 'system/ui-texts/edit', req, {
        breadcrumbs: [
          { label: 'System', href: '/system/lending-locations' },
          { label: 'UI Texte', href: '/system/ui-texts' },
          { label: entry.key, href: `/system/ui-texts/${entry.id}/edit` },
        ],
        entry,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async update(req, res, next) {
    try {
      await services.uiTextService.update(req.params.id, {
        key: req.body.key,
        de: req.body.de,
        en: req.body.en,
        isActive: req.body.isActive === 'true' || req.body.isActive === '1' || req.body.isActive === 'on',
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'UI Text gespeichert');
      }
      return res.redirect('/system/ui-texts');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async sync(req, res, next) {
    try {
      const result = await services.uiTextService.syncAutoKeysFromViews({
        viewsRoot: require('path').join(process.cwd(), 'views'),
      });
      if (typeof req.flash === 'function') {
        req.flash(
          'success',
          `UI-Texte synchronisiert: ${result && result.scanned ? result.scanned : 0} Keys gescannt, ${result && result.created ? result.created : 0} neu, ${result && result.updated ? result.updated : 0} aktualisiert.`
        );
      }
      return res.redirect('/system/ui-texts');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = UiTextController;
