const { services, renderPage, handleError } = require('../controllerUtils');

class ReportAdminController {
  async index(req, res, next) {
    try {
      return renderPage(res, 'admin/reports/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Druck & PDF', href: '/admin/reports' },
        ],
        filters: {
          includeInactive: req.query.includeInactive !== '0',
          maintenanceStatus: req.query.maintenanceStatus || '',
          maintenanceFrom: req.query.maintenanceFrom || '',
          maintenanceTo: req.query.maintenanceTo || '',
          labelQuery: req.query.labelQuery || '',
          labelOnlyActive: req.query.labelOnlyActive !== '0',
        },
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  ensureLendingLocation(req) {
    const lendingLocationId = req.lendingLocationId || req.body.lendingLocationId || req.query.lendingLocationId;
    if (!lendingLocationId) {
      const err = new Error('LendingLocation ist erforderlich');
      err.status = 422;
      throw err;
    }
    return lendingLocationId;
  }

  async inventoryPdf(req, res, next) {
    try {
      const lendingLocationId = this.ensureLendingLocation(req);
      const location = await services.lendingLocationService.getById(lendingLocationId);
      const rows = await services.reportService.getInventoryRows(lendingLocationId, {
        includeInactive: req.query.includeInactive !== '0',
      });
      const buffer = await services.reportService.generateInventoryPdf({
        lendingLocationName: location.name,
        rows,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="inventurliste.pdf"');
      return res.send(buffer);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async maintenancePdf(req, res, next) {
    try {
      const lendingLocationId = this.ensureLendingLocation(req);
      const location = await services.lendingLocationService.getById(lendingLocationId);
      const rows = await services.reportService.getMaintenanceRows(lendingLocationId, {
        status: req.query.status || '',
        dateFrom: req.query.dateFrom || '',
        dateTo: req.query.dateTo || '',
      });
      const buffer = await services.reportService.generateMaintenancePdf({
        lendingLocationName: location.name,
        rows,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="wartungsbericht.pdf"');
      return res.send(buffer);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async labelsPdf(req, res, next) {
    try {
      const lendingLocationId = this.ensureLendingLocation(req);
      const location = await services.lendingLocationService.getById(lendingLocationId);
      const assets = await services.reportService.getLabelAssets(lendingLocationId, {
        query: req.query.q || '',
        onlyActive: req.query.onlyActive !== '0',
      });
      const buffer = await services.reportService.generateLabelsPdf({
        lendingLocationName: location.name,
        assets,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="asset-etiketten.pdf"');
      return res.send(buffer);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = ReportAdminController;
