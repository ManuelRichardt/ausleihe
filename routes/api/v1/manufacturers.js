const express = require('express');
const { ManufacturerController } = require('../../../controllers/api');
const { requirePermission } = require('./authzMiddleware');
const { resolveLendingLocationId } = require('./scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/', requirePermission('inventory.manage', locationScope), ManufacturerController.create);
router.get('/', requirePermission('inventory.manage', locationScope), ManufacturerController.getAll);
router.get('/:id', requirePermission('inventory.manage', locationScope), ManufacturerController.getById);
router.put('/:id', requirePermission('inventory.manage', locationScope), ManufacturerController.update);
router.delete('/:id', requirePermission('inventory.manage', locationScope), ManufacturerController.remove);

module.exports = router;
