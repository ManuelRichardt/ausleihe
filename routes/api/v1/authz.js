const express = require('express');
const { AuthzController } = require('../../../controllers/api');
const { requirePermission } = require('./authzMiddleware');

const router = express.Router();
const globalScope = () => null;

router.post('/check', requirePermission('system.admin', globalScope), AuthzController.userHasPermission);

module.exports = router;
