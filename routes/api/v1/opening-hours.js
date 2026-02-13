const express = require('express');
const { OpeningHourController } = require('../../../controllers/api');
const { requirePermission } = require('./authz.middleware');
const { resolveLendingLocationId } = require('./_scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/regular', requirePermission('openinghours.manage', locationScope), OpeningHourController.setRegularHours);
router.get('/regular/:lendingLocationId', requirePermission('openinghours.manage', locationScope), OpeningHourController.getAllRegularHours);
router.delete('/regular/:lendingLocationId/:dayOfWeek', requirePermission('openinghours.manage', locationScope), OpeningHourController.deleteRegularHours);
router.post('/exception', requirePermission('openinghours.manage', locationScope), OpeningHourController.setException);
router.get('/exception/:lendingLocationId', requirePermission('openinghours.manage', locationScope), OpeningHourController.getAll);
router.delete('/exception/:lendingLocationId/:date', requirePermission('openinghours.manage', locationScope), OpeningHourController.deleteException);

module.exports = router;
