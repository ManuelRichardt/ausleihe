const express = require('express');
const { LoanItemController } = require('../../../controllers/api');
const { requirePermission } = require('./authzMiddleware');
const { resolveLendingLocationId } = require('./scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/', requirePermission('loan.manage', locationScope), LoanItemController.create);
router.get('/', requirePermission('loan.manage', locationScope), LoanItemController.getAll);
router.get('/:id', requirePermission('loan.manage', locationScope), LoanItemController.getById);
router.put('/:id', requirePermission('loan.manage', locationScope), LoanItemController.update);
router.post('/:id/remove-from-loan', requirePermission('loan.manage', locationScope), LoanItemController.removeFromLoan);
router.delete('/:id', requirePermission('loan.manage', locationScope), LoanItemController.remove);

module.exports = router;
