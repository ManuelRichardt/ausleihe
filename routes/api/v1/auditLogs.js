const express = require('express');
const { AuditLogController } = require('../../../controllers/api');
const { requirePermission } = require('./authzMiddleware');

const router = express.Router();
const globalScope = () => null;

router.post('/', requirePermission(['audit.view', 'system.admin'], globalScope), AuditLogController.create);
router.get('/', requirePermission(['audit.view', 'system.admin'], globalScope), AuditLogController.getAll);
router.get('/:id', requirePermission(['audit.view', 'system.admin'], globalScope), AuditLogController.getById);
router.delete('/:id', requirePermission(['audit.view', 'system.admin'], globalScope), AuditLogController.remove);

module.exports = router;
