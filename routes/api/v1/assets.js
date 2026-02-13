const express = require('express');
const { AssetInstanceController } = require('../../../controllers/api');
const { requirePermission } = require('./authz.middleware');
const { resolveLendingLocationId } = require('./_scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/', requirePermission('inventory.manage', locationScope), AssetInstanceController.create);
router.get('/', requirePermission('inventory.manage', locationScope), AssetInstanceController.getAll);
router.get('/search', requirePermission('inventory.manage', locationScope), AssetInstanceController.search);
router.get('/:id', requirePermission('inventory.manage', locationScope), AssetInstanceController.getById);
router.put('/:id', requirePermission('inventory.manage', locationScope), AssetInstanceController.update);
router.put('/:id/storage-location', requirePermission('inventory.manage', locationScope), AssetInstanceController.moveStorageLocation);
router.put('/:id/condition', requirePermission('inventory.manage', locationScope), AssetInstanceController.setCondition);
router.put('/:id/active', requirePermission('inventory.manage', locationScope), AssetInstanceController.setActive);
router.delete('/:id', requirePermission('inventory.manage', locationScope), AssetInstanceController.remove);

module.exports = router;
