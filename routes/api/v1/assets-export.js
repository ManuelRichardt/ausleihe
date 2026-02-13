const express = require('express');
const AdminAssetExportController = require('../../../controllers/AdminAssetExportController');
const { requirePermission } = require('./authz.middleware');
const { resolveLendingLocationId } = require('./_scope');

const router = express.Router();
const controller = new AdminAssetExportController();
const locationScope = (req) => resolveLendingLocationId(req);

router.get('/assets/export', requirePermission('inventory.manage', locationScope), controller.exportAssets.bind(controller));
router.get('/asset-models/export', requirePermission('inventory.manage', locationScope), controller.exportModels.bind(controller));
router.get('/exports/combined', requirePermission('inventory.manage', locationScope), controller.exportCombined.bind(controller));

module.exports = router;
