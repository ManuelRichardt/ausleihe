const express = require('express');
const injectUser = require('../../middleware/web/injectUser');
const lendingLocationContext = require('../../middleware/web/lendingLocationContext');
const navigationMiddleware = require('../../middleware/navigationMiddleware');
const i18nMiddleware = require('../../middleware/i18n');
const HomeController = require('../../controllers/web/HomeController');

const authRoutes = require('./authRoutes');
const installRoutes = require('./installRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const assetsRoutes = require('./assetsRoutes');
const cartRoutes = require('./cartRoutes');
const reservationsRoutes = require('./reservationsRoutes');
const loansRoutes = require('./loansRoutes');
const profileRoutes = require('./profileRoutes');
const adminRoutes = require('./adminRoutes');
const systemRoutes = require('./systemRoutes');
const signatureRoutes = require('./signaturesRoutes');
const authConfigRoutes = require('./adminAuthConfigRoutes');

const router = express.Router();
const homeController = new HomeController();

router.use(installRoutes);
router.use(injectUser);
router.use(i18nMiddleware);
router.use(lendingLocationContext);
router.use(navigationMiddleware);

router.get('/', homeController.index.bind(homeController));

router.use(authRoutes);
router.use(dashboardRoutes);
router.use(assetsRoutes);
router.use(cartRoutes);
router.use(reservationsRoutes);
router.use(loansRoutes);
router.use(profileRoutes);
router.use(signatureRoutes);
router.use(adminRoutes);
router.use(systemRoutes);
router.use(authConfigRoutes);

module.exports = router;
