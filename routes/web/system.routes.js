const express = require('express');
const requireLogin = require('../../middlewares/web/requireLogin');
const requirePermission = require('../../middlewares/web/requirePermission');
const LendingLocationController = require('../../controllers/web/system/LendingLocationController');
const AuditLogController = require('../../controllers/web/system/AuditLogController');
const LendingLocationContextController = require('../../controllers/web/system/LendingLocationContextController');
const validate = require('../../middleware/validate');
const { lendingLocationValidation } = require('../../validation');

const router = express.Router();
const globalScope = () => null;
const locationScope = (req) => req.params.id || null;
const lendingLocationController = new LendingLocationController();
const auditLogController = new AuditLogController();
const lendingLocationContextController = new LendingLocationContextController();

router.get(
  '/system/lending-locations',
  requireLogin,
  requirePermission('system.admin', globalScope),
  lendingLocationController.index.bind(lendingLocationController)
);
router.get(
  '/system/lending-locations/new',
  requireLogin,
  requirePermission('system.admin', globalScope),
  lendingLocationController.new.bind(lendingLocationController)
);
router.post(
  '/system/lending-locations/select',
  requireLogin,
  lendingLocationContextController.setActive.bind(lendingLocationContextController)
);
router.post(
  '/system/lending-locations',
  requireLogin,
  requirePermission('system.admin', globalScope),
  lendingLocationValidation,
  validate('system/lending-locations/new'),
  lendingLocationController.create.bind(lendingLocationController)
);
router.get(
  '/system/lending-locations/:id',
  requireLogin,
  requirePermission(['system.admin', 'lendinglocations.manage'], locationScope),
  lendingLocationController.show.bind(lendingLocationController)
);
router.get(
  '/system/lending-locations/:id/edit',
  requireLogin,
  requirePermission(['system.admin', 'lendinglocations.manage'], locationScope),
  lendingLocationController.edit.bind(lendingLocationController)
);
router.post(
  '/system/lending-locations/:id',
  requireLogin,
  requirePermission(['system.admin', 'lendinglocations.manage'], locationScope),
  lendingLocationValidation,
  validate('system/lending-locations/edit'),
  lendingLocationController.update.bind(lendingLocationController)
);
router.post(
  '/system/lending-locations/:id/delete',
  requireLogin,
  requirePermission('system.admin', globalScope),
  lendingLocationController.remove.bind(lendingLocationController)
);
router.post(
  '/system/lending-locations/:id/restore',
  requireLogin,
  requirePermission('system.admin', globalScope),
  lendingLocationController.restore.bind(lendingLocationController)
);
router.get(
  '/system/audit-log',
  requireLogin,
  requirePermission(['system.admin', 'audit.view'], globalScope),
  auditLogController.index.bind(auditLogController)
);

module.exports = router;
