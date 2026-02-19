const express = require('express');
const { RoleController } = require('../../../controllers/api');
const { requirePermission } = require('./authzMiddleware');

const router = express.Router();
const globalScope = () => null;

router.post('/', requirePermission('roles.manage', globalScope), RoleController.create);
router.get('/', requirePermission('roles.manage', globalScope), RoleController.getAll);
router.get('/search', requirePermission('roles.manage', globalScope), RoleController.search);
router.get('/:id', requirePermission('roles.manage', globalScope), RoleController.getById);
router.put('/:id', requirePermission('roles.manage', globalScope), RoleController.update);
router.post('/:id/permissions', requirePermission('roles.manage', globalScope), RoleController.addPermission);
router.delete('/:id/permissions', requirePermission('roles.manage', globalScope), RoleController.removePermission);
router.delete('/:id', requirePermission('roles.manage', globalScope), RoleController.remove);

module.exports = router;
