const { renderPage, handleError } = require('../_controllerUtils');

class ExportAdminController {
  async index(req, res, next) {
    try {
      return renderPage(res, 'admin/exports/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Exporte', href: '/admin/exports' },
        ],
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = ExportAdminController;
