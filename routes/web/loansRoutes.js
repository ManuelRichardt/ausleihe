const express = require('express');
const requireLogin = require('../../middleware/web/requireLogin');
const requirePermission = require('../../middleware/web/requirePermission');
const UserLoanController = require('../../controllers/web/user/loanController');

const router = express.Router();
const controller = new UserLoanController();

router.get(
  '/loans',
  requireLogin,
  requirePermission(['loan.create', 'loan.manage'], null),
  controller.index.bind(controller)
);

router.get(
  '/loans/:id',
  requireLogin,
  requirePermission(['loan.create', 'loan.manage'], null),
  controller.show.bind(controller)
);

module.exports = router;
