const express = require('express');
const requireLogin = require('../../middleware/web/requireLogin');
const DashboardController = require('../../controllers/web/dashboardController');

const router = express.Router();
const controller = new DashboardController();

router.get('/dashboard', requireLogin, controller.index.bind(controller));

module.exports = router;
