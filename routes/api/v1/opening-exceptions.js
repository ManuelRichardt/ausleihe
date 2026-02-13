const express = require('express');
const { OpeningExceptionController } = require('../../../controllers/api');
const { requirePermission } = require('./authz.middleware');
const { resolveLendingLocationId } = require('./_scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/', requirePermission('openinghours.manage', locationScope), OpeningExceptionController.create);
router.get('/', requirePermission('openinghours.manage', locationScope), OpeningExceptionController.getAll);
router.get('/:id', requirePermission('openinghours.manage', locationScope), OpeningExceptionController.getById);
router.put('/:id', requirePermission('openinghours.manage', locationScope), OpeningExceptionController.update);
router.delete('/:id', requirePermission('openinghours.manage', locationScope), OpeningExceptionController.remove);

module.exports = router;
