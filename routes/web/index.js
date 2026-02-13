const express = require('express');
const injectUser = require('../../middlewares/web/injectUser');
const lendingLocationContext = require('../../middlewares/web/lendingLocationContext');
const navigationMiddleware = require('../../middleware/navigation.middleware');
const HomeController = require('../../controllers/web/HomeController');

const authRoutes = require('./auth.routes');
const installRoutes = require('./install.routes');
const dashboardRoutes = require('./dashboard.routes');
const assetsRoutes = require('./assets.routes');
const cartRoutes = require('./cart.routes');
const reservationsRoutes = require('./reservations.routes');
const loansRoutes = require('./loans.routes');
const adminRoutes = require('./admin.routes');
const systemRoutes = require('./system.routes');
const signatureRoutes = require('./signatures');
const authConfigRoutes = require('./admin.auth-config.routes');

const router = express.Router();
const homeController = new HomeController();

router.use(installRoutes);
router.use(injectUser);
router.use(lendingLocationContext);
router.use(navigationMiddleware);

router.get('/', homeController.index.bind(homeController));

router.use(authRoutes);
router.use(dashboardRoutes);
router.use(assetsRoutes);
router.use(cartRoutes);
router.use(reservationsRoutes);
router.use(loansRoutes);
router.use(signatureRoutes);
router.use(adminRoutes);
router.use(systemRoutes);
router.use(authConfigRoutes);

module.exports = router;
