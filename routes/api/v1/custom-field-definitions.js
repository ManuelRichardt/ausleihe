const express = require('express');
const { CustomFieldDefinitionController } = require('../../../controllers/api');
const { requirePermission } = require('./authz.middleware');

const router = express.Router();
const globalScope = () => null;

router.post('/', requirePermission('customfields.manage', globalScope), CustomFieldDefinitionController.create);
router.get('/asset-model/:assetModelId', requirePermission('customfields.manage', globalScope), CustomFieldDefinitionController.getByAssetModel);
router.get('/lending-location/:lendingLocationId', requirePermission('customfields.manage', globalScope), CustomFieldDefinitionController.getByLendingLocation);
router.get('/asset-instance/:assetInstanceId/resolve', requirePermission('customfields.manage', globalScope), CustomFieldDefinitionController.resolveForAssetInstance);
router.get('/:id', requirePermission('customfields.manage', globalScope), CustomFieldDefinitionController.getById);
router.put('/:id', requirePermission('customfields.manage', globalScope), CustomFieldDefinitionController.update);
router.put('/:id/deactivate', requirePermission('customfields.manage', globalScope), CustomFieldDefinitionController.deactivate);
router.delete('/:id', requirePermission('customfields.manage', globalScope), CustomFieldDefinitionController.remove);

module.exports = router;
