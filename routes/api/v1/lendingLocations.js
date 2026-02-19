const express = require('express');
const { LendingLocationController } = require('../../../controllers/api');
const { requirePermission } = require('./authzMiddleware');

const router = express.Router();
const globalScope = () => null;
const locationScope = (req) => req.params.id || null;

router.post('/', requirePermission('system.admin', globalScope), LendingLocationController.create);
router.get('/', requirePermission('system.admin', globalScope), LendingLocationController.getAll);
router.get('/:id', requirePermission(['system.admin', 'lendinglocations.manage'], locationScope), LendingLocationController.getById);
router.put('/:id', requirePermission(['system.admin', 'lendinglocations.manage'], locationScope), LendingLocationController.update);
router.put('/:id/active', requirePermission(['system.admin', 'lendinglocations.manage'], locationScope), LendingLocationController.setActive);
router.delete('/:id', requirePermission('system.admin', globalScope), LendingLocationController.remove);

module.exports = router;
