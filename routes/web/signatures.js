const express = require('express');
const requireLogin = require('../../middleware/web/requireLogin');
const requirePermission = require('../../middleware/web/requirePermission');
const lendingLocationContext = require('../../middleware/web/lendingLocationContext');
const resolveLoanScope = require('../../middleware/loanScope');
const LoanSignatureController = require('../../controllers/LoanSignatureController');
const validate = require('../../middleware/validate');
const { loanSignValidation } = require('../../validation');

const router = express.Router();
const controller = new LoanSignatureController();
const scopeResolver = (req) => req.lendingLocationId || null;

router.get(
  '/loans/:id/sign',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', scopeResolver),
  controller.renderSignPage.bind(controller)
);

router.post(
  '/loans/:id/sign',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', scopeResolver),
  loanSignValidation,
  validate('loans/sign'),
  controller.storeSignature.bind(controller)
);

router.get(
  '/loans/:id/print',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', scopeResolver),
  controller.renderPrintableDocument.bind(controller)
);

module.exports = router;
