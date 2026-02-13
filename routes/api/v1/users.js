const express = require('express');
const { UserController } = require('../../../controllers/api');
const { requirePermission } = require('./authz.middleware');

const router = express.Router();
const globalScope = () => null;

router.post('/', requirePermission('users.manage', globalScope), UserController.create);
router.get('/', requirePermission('users.manage', globalScope), UserController.getAll);
router.get('/search', requirePermission('users.manage', globalScope), UserController.search);
router.get('/username/:username', requirePermission('users.manage', globalScope), UserController.getByUsername);
router.get('/:id', requirePermission('users.manage', globalScope), UserController.getById);
router.put('/:id', requirePermission('users.manage', globalScope), UserController.update);
router.put('/:id/password', requirePermission('users.manage', globalScope), UserController.setPassword);
router.put('/:id/active', requirePermission('users.manage', globalScope), UserController.setActive);
router.delete('/:id', requirePermission('users.manage', globalScope), UserController.remove);
router.get('/:id/roles', requirePermission('users.manage', globalScope), UserController.listUserRoles);
router.post('/:id/roles', requirePermission('users.manage', globalScope), UserController.assignRole);
router.delete('/:id/roles', requirePermission('users.manage', globalScope), UserController.revokeRole);

module.exports = router;
