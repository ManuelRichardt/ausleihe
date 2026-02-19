const express = require('express');
const requireLogin = require('../../middleware/web/requireLogin');
const requirePermission = require('../../middleware/web/requirePermission');
const LendingLocationController = require('../../controllers/web/system/lendingLocationController');
const AuditLogController = require('../../controllers/web/system/auditLogController');
const LendingLocationContextController = require('../../controllers/web/system/lendingLocationContextController');
const UiTextController = require('../../controllers/web/system/uiTextController');
const MailAdminController = require('../../controllers/web/system/mailAdminController');
const PrivacyController = require('../../controllers/web/system/privacyController');
const validate = require('../../middleware/validation/handleValidation');
const { lendingLocationValidation } = require('../../middleware/validation');
const { uploadLendingLocationImage } = require('../../middleware/imageUpload');

const router = express.Router();
const globalScope = () => null;
const locationScope = (req) => req.params.id || null;
const lendingLocationController = new LendingLocationController();
const auditLogController = new AuditLogController();
const lendingLocationContextController = new LendingLocationContextController();
const uiTextController = new UiTextController();
const mailAdminController = new MailAdminController();
const privacyController = new PrivacyController();

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
  uploadLendingLocationImage,
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
  uploadLendingLocationImage,
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
router.get(
  '/system/ui-texts',
  requireLogin,
  requirePermission('system.admin', globalScope),
  uiTextController.index.bind(uiTextController)
);
router.post(
  '/system/ui-texts',
  requireLogin,
  requirePermission('system.admin', globalScope),
  uiTextController.create.bind(uiTextController)
);
router.post(
  '/system/ui-texts/sync',
  requireLogin,
  requirePermission('system.admin', globalScope),
  uiTextController.sync.bind(uiTextController)
);
router.get(
  '/system/ui-texts/:id/edit',
  requireLogin,
  requirePermission('system.admin', globalScope),
  uiTextController.edit.bind(uiTextController)
);
router.post(
  '/system/ui-texts/:id',
  requireLogin,
  requirePermission('system.admin', globalScope),
  uiTextController.update.bind(uiTextController)
);
router.get(
  '/system/mail',
  requireLogin,
  requirePermission('system.admin', globalScope),
  mailAdminController.index.bind(mailAdminController)
);
router.post(
  '/system/mail/config',
  requireLogin,
  requirePermission('system.admin', globalScope),
  mailAdminController.updateConfig.bind(mailAdminController)
);
router.post(
  '/system/mail/test',
  requireLogin,
  requirePermission('system.admin', globalScope),
  mailAdminController.sendTest.bind(mailAdminController)
);
router.post(
  '/system/mail/process-pending',
  requireLogin,
  requirePermission('system.admin', globalScope),
  mailAdminController.processPending.bind(mailAdminController)
);
router.post(
  '/system/mail/queue-reminders',
  requireLogin,
  requirePermission('system.admin', globalScope),
  mailAdminController.queueReminders.bind(mailAdminController)
);
router.get(
  '/system/mail/templates/:id/edit',
  requireLogin,
  requirePermission('system.admin', globalScope),
  mailAdminController.editTemplate.bind(mailAdminController)
);
router.post(
  '/system/mail/templates/:id',
  requireLogin,
  requirePermission('system.admin', globalScope),
  mailAdminController.updateTemplate.bind(mailAdminController)
);
router.get(
  '/system/privacy',
  requireLogin,
  requirePermission('system.admin', globalScope),
  privacyController.index.bind(privacyController)
);
router.post(
  '/system/privacy/config',
  requireLogin,
  requirePermission('system.admin', globalScope),
  privacyController.updateConfig.bind(privacyController)
);
router.post(
  '/system/privacy/run-cleanup',
  requireLogin,
  requirePermission('system.admin', globalScope),
  privacyController.runCleanup.bind(privacyController)
);
router.post(
  '/system/privacy/requests',
  requireLogin,
  requirePermission('system.admin', globalScope),
  privacyController.createRequest.bind(privacyController)
);
router.post(
  '/system/privacy/requests/:id/process',
  requireLogin,
  requirePermission('system.admin', globalScope),
  privacyController.processRequest.bind(privacyController)
);
router.post(
  '/system/privacy/requests/:id/reject',
  requireLogin,
  requirePermission('system.admin', globalScope),
  privacyController.rejectRequest.bind(privacyController)
);
router.get(
  '/system/privacy/users/search',
  requireLogin,
  requirePermission('system.admin', globalScope),
  privacyController.searchUsers.bind(privacyController)
);

module.exports = router;
