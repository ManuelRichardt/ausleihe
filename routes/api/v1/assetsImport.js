const express = require('express');
const AdminAssetImportController = require('../../../controllers/adminAssetImportController');
const { requirePermission } = require('./authzMiddleware');
const { resolveLendingLocationId } = require('./scope');

const router = express.Router();
const controller = new AdminAssetImportController();
const locationScope = (req) => resolveLendingLocationId(req);

router.post(
  '/assets/import/preview',
  requirePermission('inventory.manage', locationScope),
  controller.uploadMiddleware,
  controller.previewImport.bind(controller)
);
router.post(
  '/assets/import',
  requirePermission('inventory.manage', locationScope),
  controller.uploadMiddleware,
  controller.executeImport.bind(controller)
);

module.exports = router;
