const express = require('express');
const requireLogin = require('../../middleware/web/requireLogin');
const requirePermission = require('../../middleware/web/requirePermission');
const CartController = require('../../controllers/web/CartController');

const router = express.Router();
const controller = new CartController();

router.get('/cart', requireLogin, requirePermission('loan.create', null), controller.show.bind(controller));
router.post('/cart/items', requireLogin, requirePermission('loan.create', null), controller.addItem.bind(controller));
router.post('/cart/items/:id', requireLogin, requirePermission('loan.create', null), controller.updateItem.bind(controller));
router.post('/cart/items/:id/delete', requireLogin, requirePermission('loan.create', null), controller.removeItem.bind(controller));
router.post('/cart/checkout', requireLogin, requirePermission('loan.create', null), controller.checkout.bind(controller));

module.exports = router;
