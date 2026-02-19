const express = require('express');
const requireLogin = require('../../middleware/web/requireLogin');
const requirePermission = require('../../middleware/web/requirePermission');
const UserReservationController = require('../../controllers/web/user/reservationController');

const router = express.Router();
const controller = new UserReservationController();

router.get(
  '/reservations',
  requireLogin,
  requirePermission(['loan.create', 'loan.manage'], null),
  controller.index.bind(controller)
);

router.get(
  '/reservations/:id',
  requireLogin,
  requirePermission(['loan.create', 'loan.manage'], null),
  controller.show.bind(controller)
);

router.post(
  '/reservations/:id/cancel',
  requireLogin,
  requirePermission(['loan.create', 'loan.manage'], null),
  controller.cancel.bind(controller)
);

module.exports = router;
