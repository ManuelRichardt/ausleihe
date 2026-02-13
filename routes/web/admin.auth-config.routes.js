const express = require('express');
const requireLogin = require('../../middlewares/web/requireLogin');
const requirePermission = require('../../middlewares/web/requirePermission');
const AuthConfigController = require('../../controllers/admin/AuthConfigController');

const router = express.Router();
const controller = new AuthConfigController();
const globalScope = () => null;

router.get(
  '/system/auth-config',
  requireLogin,
  requirePermission('system.auth.manage', globalScope),
  controller.index.bind(controller)
);

router.post(
  '/system/auth-config/saml',
  requireLogin,
  requirePermission('system.auth.manage', globalScope),
  controller.updateSaml.bind(controller)
);

router.post(
  '/system/auth-config/ldap',
  requireLogin,
  requirePermission('system.auth.manage', globalScope),
  controller.updateLdap.bind(controller)
);

router.post(
  '/system/auth-config/ldap/test',
  requireLogin,
  requirePermission('system.auth.manage', globalScope),
  controller.testLdap.bind(controller)
);

module.exports = router;
