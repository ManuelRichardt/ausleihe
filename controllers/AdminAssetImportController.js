const multer = require('multer');
const CsvImportService = require('../services/csvImportService');
const models = require('../models');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
      return cb(new Error('Nur CSV oder XLSX Dateien sind erlaubt'));
    }
    return cb(null, true);
  },
});

class AdminAssetImportController {
  constructor() {
    this.importService = new CsvImportService(models);
    this.uploadMiddleware = upload.single('file');
  }

  async renderImportPage(req, res, next) {
    try {
      return res.render('admin/assets/import', {
        layout: 'layout/main',
        errors: res.locals.errors || {},
        formData: res.locals.formData || {},
        result: null,
      });
    } catch (err) {
      return next(err);
    }
  }

  async previewImport(req, res, next) {
    try {
      if (!req.file) {
        const err = new Error('Datei fehlt');
        err.status = 400;
        throw err;
      }
      const rows = await this.importService.parseFile(req.file.buffer, req.file.originalname);
      res.json({ preview: rows.slice(0, 20) });
    } catch (err) {
      next(err);
    }
  }

  async executeImport(req, res, next) {
    try {
      if (!req.file) {
        const err = new Error('Datei fehlt');
        err.status = 400;
        throw err;
      }
      const lendingLocationId = req.lendingLocationId || req.body.lendingLocationId;
      if (req.lendingLocationId && req.body.lendingLocationId && req.lendingLocationId !== req.body.lendingLocationId) {
        const err = new Error('Access denied');
        err.status = 403;
        throw err;
      }
      const result = await this.importService.importAssets(req.file.buffer, {
        filename: req.file.originalname,
        lendingLocationId,
      });

      if (req.accepts('html')) {
        return res.render('admin/assets/import', {
          layout: 'layout/main',
          errors: {},
          formData: {},
          result,
        });
      }

      return res.json(result);
    } catch (err) {
      if (req.accepts('html')) {
        return res.status(err.status || 422).render('admin/assets/import', {
          layout: 'layout/main',
          errors: { import: err.message },
          formData: req.body || {},
          result: null,
        });
      }
      next(err);
    }
  }
}

module.exports = AdminAssetImportController;
