const express = require('express');
const { LoanSignatureController } = require('../../../controllers/api');
const { requirePermission } = require('./authz.middleware');
const { resolveLendingLocationId } = require('./_scope');

const router = express.Router();
const locationScope = (req) => resolveLendingLocationId(req);

router.post('/', requirePermission('loan.manage', locationScope), LoanSignatureController.create);
router.get('/', requirePermission('loan.manage', locationScope), LoanSignatureController.getAll);
router.get('/:id', requirePermission('loan.manage', locationScope), LoanSignatureController.getById);
router.put('/:id', requirePermission('loan.manage', locationScope), LoanSignatureController.update);
router.delete('/:id', requirePermission('loan.manage', locationScope), LoanSignatureController.remove);

module.exports = router;
