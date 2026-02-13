const express = require('express');
const { AssetMaintenanceController } = require('../../../controllers/api');
const { requirePermission } = require('./authz.middleware');
const { resolveLendingLocationId } = require('./_scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/', requirePermission('inventory.manage', locationScope), AssetMaintenanceController.create);
router.get('/', requirePermission('inventory.manage', locationScope), AssetMaintenanceController.getAll);
router.get('/:id', requirePermission('inventory.manage', locationScope), AssetMaintenanceController.getById);
router.put('/:id', requirePermission('inventory.manage', locationScope), AssetMaintenanceController.update);
router.put('/:id/complete', requirePermission('inventory.manage', locationScope), AssetMaintenanceController.complete);
router.delete('/:id', requirePermission('inventory.manage', locationScope), AssetMaintenanceController.remove);

module.exports = router;
