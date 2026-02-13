const express = require('express');
const { AssetAttachmentController } = require('../../../controllers/api');
const { requirePermission } = require('./authz.middleware');
const { resolveLendingLocationId } = require('./_scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/', requirePermission('inventory.manage', locationScope), AssetAttachmentController.create);
router.get('/', requirePermission('inventory.manage', locationScope), AssetAttachmentController.getAll);
router.get('/:id', requirePermission('inventory.manage', locationScope), AssetAttachmentController.getById);
router.put('/:id', requirePermission('inventory.manage', locationScope), AssetAttachmentController.update);
router.delete('/:id', requirePermission('inventory.manage', locationScope), AssetAttachmentController.remove);

module.exports = router;
