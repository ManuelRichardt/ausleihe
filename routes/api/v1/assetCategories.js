const express = require('express');
const { AssetCategoryController } = require('../../../controllers/api');
const { requirePermission } = require('./authzMiddleware');
const { resolveLendingLocationId } = require('./scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/', requirePermission('inventory.manage', locationScope), AssetCategoryController.create);
router.get('/', requirePermission('inventory.manage', locationScope), AssetCategoryController.getAll);
router.get('/:id', requirePermission('inventory.manage', locationScope), AssetCategoryController.getById);
router.put('/:id', requirePermission('inventory.manage', locationScope), AssetCategoryController.update);
router.put('/:id/active', requirePermission('inventory.manage', locationScope), AssetCategoryController.setActive);
router.delete('/:id', requirePermission('inventory.manage', locationScope), AssetCategoryController.remove);

module.exports = router;
