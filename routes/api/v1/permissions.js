const express = require('express');
const { PermissionController } = require('../../../controllers/api');
const { requirePermission } = require('./authzMiddleware');

const router = express.Router();
const globalScope = () => null;

router.post('/', requirePermission('permissions.manage', globalScope), PermissionController.create);
router.get('/', requirePermission('permissions.manage', globalScope), PermissionController.getAll);
router.get('/search', requirePermission('permissions.manage', globalScope), PermissionController.search);
router.get('/key/:key', requirePermission('permissions.manage', globalScope), PermissionController.getByKey);
router.get('/:id', requirePermission('permissions.manage', globalScope), PermissionController.getById);
router.put('/:id', requirePermission('permissions.manage', globalScope), PermissionController.update);
router.delete('/:id', requirePermission('permissions.manage', globalScope), PermissionController.remove);

module.exports = router;
