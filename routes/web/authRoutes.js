const express = require('express');
const AuthController = require('../../controllers/web/AuthController');
const validate = require('../../middleware/validation/handleValidation');
const { loginValidation } = require('../../middleware/validation');
const { loginLimiter } = require('../../middleware/rateLimit');
const loadAuthProviders = require('../../middleware/loadAuthProviders');
const requireLogin = require('../../middleware/web/requireLogin');

const router = express.Router();
const controller = new AuthController();
router.get('/login', controller.showLogin.bind(controller));
router.post('/login', loginLimiter, loadAuthProviders, loginValidation, validate('auth/login'), controller.localLogin.bind(controller));
router.get('/auth/saml', controller.samlLogin.bind(controller));
router.post('/auth/saml/callback', controller.samlCallback.bind(controller));
router.get('/auth/saml/metadata', controller.samlMetadata.bind(controller));
router.post('/auth/ldap', loginLimiter, loadAuthProviders, loginValidation, validate('auth/login'), controller.ldapLogin.bind(controller));
router.post('/logout', controller.logout.bind(controller));
router.get('/access-denied', requireLogin, controller.accessDenied.bind(controller));

module.exports = router;
