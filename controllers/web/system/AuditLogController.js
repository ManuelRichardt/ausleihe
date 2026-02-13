const { services, renderPage, handleError } = require('../_controllerUtils');

class AuditLogController {
  async index(req, res, next) {
    try {
      const logs = await services.auditLogService.getAll({});
      return renderPage(res, 'system/audit-log/index', req, {
        breadcrumbs: [
          { label: 'System', href: '/system/lending-locations' },
          { label: 'Audit Log', href: '/system/audit-log' },
        ],
        logs,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = AuditLogController;
