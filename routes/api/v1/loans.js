const express = require('express');
const { LoanController } = require('../../../controllers/api');
const { requirePermission } = require('./authz.middleware');
const { resolveLendingLocationId } = require('./_scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/', requirePermission('loan.manage', locationScope), LoanController.createReservation);
router.get('/', requirePermission('loan.manage', locationScope), LoanController.getAll);
router.get('/:id', requirePermission('loan.manage', locationScope), LoanController.getById);
router.post('/:id/cancel', requirePermission('loan.manage', locationScope), LoanController.cancel);
router.post('/:id/hand-over', requirePermission('loan.manage', locationScope), LoanController.handOver);
router.post('/:id/return', requirePermission('loan.manage', locationScope), LoanController.returnLoan);
router.post('/:id/overdue', requirePermission('loan.manage', locationScope), LoanController.markOverdue);
router.delete('/:id', requirePermission('loan.manage', locationScope), LoanController.remove);

module.exports = router;
