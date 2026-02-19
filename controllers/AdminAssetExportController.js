const CsvExportService = require('../services/csvExportService');
const models = require('../models');
const { createServices } = require('../services');

class AdminAssetExportController {
  constructor() {
    this.exportService = new CsvExportService(models);
    this.services = createServices(models);
  }

  async exportAssets(req, res, next) {
    try {
      const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
      const buffer = await this.exportService.exportAssets(
        {
          lendingLocationId: req.query.lendingLocationId,
          status: req.query.status,
          categoryId: req.query.categoryId,
        },
        format
      );
      if (req.user && req.user.id) {
        await this.services.auditLogService.logAction({
          userId: req.user.id,
          action: 'export.assets',
          entity: 'User',
          entityId: req.user.id,
          metadata: {
            lendingLocationId: req.query.lendingLocationId || null,
            status: req.query.status || null,
            categoryId: req.query.categoryId || null,
            ipAddress: req.ip,
          },
        });
      }
      if (format === 'xlsx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="assets-export.xlsx"');
      } else {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="assets-export.csv"');
      }
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  async exportModels(req, res, next) {
    try {
      const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
      const buffer = await this.exportService.exportModels(
        {
          categoryId: req.query.categoryId,
        },
        format
      );
      if (req.user && req.user.id) {
        await this.services.auditLogService.logAction({
          userId: req.user.id,
          action: 'export.asset_models',
          entity: 'User',
          entityId: req.user.id,
          metadata: {
            categoryId: req.query.categoryId || null,
            ipAddress: req.ip,
          },
        });
      }
      if (format === 'xlsx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="models-export.xlsx"');
      } else {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="models-export.csv"');
      }
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  async exportCombined(req, res, next) {
    try {
      const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
      const buffer = await this.exportService.exportCombined(
        {
          lendingLocationId: req.query.lendingLocationId,
          status: req.query.status,
          categoryId: req.query.categoryId,
        },
        format
      );
      if (req.user && req.user.id) {
        await this.services.auditLogService.logAction({
          userId: req.user.id,
          action: 'export.combined',
          entity: 'User',
          entityId: req.user.id,
          metadata: {
            lendingLocationId: req.query.lendingLocationId || null,
            status: req.query.status || null,
            categoryId: req.query.categoryId || null,
            ipAddress: req.ip,
          },
        });
      }
      if (format === 'xlsx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory-export.xlsx"');
      } else {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory-export.csv"');
      }
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AdminAssetExportController;
