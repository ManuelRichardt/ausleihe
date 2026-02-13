const express = require('express');
const InstallController = require('../../controllers/web/InstallController');

const router = express.Router();
const controller = new InstallController();

router.get('/install', controller.show.bind(controller));
router.post('/install', controller.submit.bind(controller));

module.exports = router;
