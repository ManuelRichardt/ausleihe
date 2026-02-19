const {
  services,
  renderPage,
  handleError,
  parseListQuery,
  buildPagination,
} = require('../controllerUtils');

class AuditLogController {
  async index(req, res, next) {
    try {
      const { page, limit, offset, order } = parseListQuery(req, ['createdAt', 'action', 'entity'], {
        order: [['createdAt', 'DESC']],
      });
      const filter = {};
      if (req.query.action) {
        filter.action = req.query.action;
      }
      if (req.query.entity) {
        filter.entity = req.query.entity;
      }
      if (req.query.dateFrom) {
        filter.dateFrom = req.query.dateFrom;
      }
      if (req.query.dateTo) {
        filter.dateTo = req.query.dateTo;
      }

      const total = await services.auditLogService.countLogs(filter);
      const logs = await services.auditLogService.getAll(filter, { limit, offset, order });
      const actionOptionsRaw = await services.auditLogService.distinctValues('action');
      const entityOptionsRaw = await services.auditLogService.distinctValues('entity');

      return renderPage(res, 'system/audit-log/index', req, {
        breadcrumbs: [
          { label: 'System', href: '/system/lending-locations' },
          { label: 'Audit Log', href: '/system/audit-log' },
        ],
        logs,
        filters: {
          action: req.query.action || '',
          entity: req.query.entity || '',
          dateFrom: req.query.dateFrom || '',
          dateTo: req.query.dateTo || '',
        },
        actionOptions: actionOptionsRaw.map((row) => row.value).filter(Boolean),
        entityOptions: entityOptionsRaw.map((row) => row.value).filter(Boolean),
        pagination: buildPagination(page, limit, total),
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = AuditLogController;
