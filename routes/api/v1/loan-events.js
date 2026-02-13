const express = require('express');
const { LoanEventController } = require('../../../controllers/api');
const { requirePermission } = require('./authz.middleware');
const { resolveLendingLocationId } = require('./_scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/', requirePermission('loan.manage', locationScope), LoanEventController.create);
router.get('/', requirePermission('loan.manage', locationScope), LoanEventController.getAll);
router.get('/:id', requirePermission('loan.manage', locationScope), LoanEventController.getById);
router.put('/:id', requirePermission('loan.manage', locationScope), LoanEventController.update);
router.delete('/:id', requirePermission('loan.manage', locationScope), LoanEventController.remove);

module.exports = router;
