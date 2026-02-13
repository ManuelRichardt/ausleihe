const express = require('express');
const { StorageLocationController } = require('../../../controllers/api');
const { requirePermission } = require('./authz.middleware');
const { resolveLendingLocationId } = require('./_scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/', requirePermission('inventory.manage', locationScope), StorageLocationController.create);
router.get('/', requirePermission('inventory.manage', locationScope), StorageLocationController.getAll);
router.get('/:id', requirePermission('inventory.manage', locationScope), StorageLocationController.getById);
router.put('/:id', requirePermission('inventory.manage', locationScope), StorageLocationController.update);
router.put('/:id/active', requirePermission('inventory.manage', locationScope), StorageLocationController.setActive);
router.delete('/:id', requirePermission('inventory.manage', locationScope), StorageLocationController.remove);

module.exports = router;
