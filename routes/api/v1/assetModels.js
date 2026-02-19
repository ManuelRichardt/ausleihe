const express = require('express');
const { AssetModelController } = require('../../../controllers/api');
const { requirePermission } = require('./authzMiddleware');
const { resolveLendingLocationId } = require('./scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/', requirePermission('inventory.manage', locationScope), AssetModelController.create);
router.get('/', requirePermission('inventory.manage', locationScope), AssetModelController.getAll);
router.get('/:id', requirePermission('inventory.manage', locationScope), AssetModelController.getById);
router.put('/:id', requirePermission('inventory.manage', locationScope), AssetModelController.update);
router.delete('/:id', requirePermission('inventory.manage', locationScope), AssetModelController.remove);

module.exports = router;
