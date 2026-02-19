const express = require('express');
const { CustomFieldValueController } = require('../../../controllers/api');
const { requirePermission } = require('./authzMiddleware');
const { resolveLendingLocationId } = require('./scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.put(
  '/:assetInstanceId/:customFieldDefinitionId',
  requirePermission('inventory.manage', locationScope),
  CustomFieldValueController.setValue
);
router.get('/:assetInstanceId', requirePermission('inventory.manage', locationScope), CustomFieldValueController.getValuesByAssetInstance);
router.delete(
  '/:assetInstanceId/:customFieldDefinitionId',
  requirePermission('inventory.manage', locationScope),
  CustomFieldValueController.removeValue
);

module.exports = router;
