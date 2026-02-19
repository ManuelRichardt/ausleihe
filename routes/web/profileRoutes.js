const express = require('express');
const requireLogin = require('../../middleware/web/requireLogin');
const ProfileController = require('../../controllers/web/ProfileController');

const router = express.Router();
const controller = new ProfileController();

router.get('/profile', requireLogin, controller.show.bind(controller));

module.exports = router;
