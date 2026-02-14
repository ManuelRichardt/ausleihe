const express = require('express');
const requireLogin = require('../../middlewares/web/requireLogin');
const requirePermission = require('../../middlewares/web/requirePermission');
const lendingLocationContext = require('../../middlewares/web/lendingLocationContext');
const AssetController = require('../../controllers/web/AssetController');
const CatalogController = require('../../controllers/web/CatalogController');

const router = express.Router();
const controller = new AssetController();
const catalogController = new CatalogController();
const scopeResolver = (req) => req.lendingLocationId || null;
const viewPermissions = ['loan.create', 'loan.manage', 'inventory.manage'];

router.get(
  '/lending-locations',
  requireLogin,
  lendingLocationContext,
  requirePermission(viewPermissions, scopeResolver),
  catalogController.lendingLocations.bind(catalogController)
);
router.get(
  '/lending-locations/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission(viewPermissions, scopeResolver),
  catalogController.lendingLocationShow.bind(catalogController)
);
router.get(
  '/categories',
  requireLogin,
  lendingLocationContext,
  requirePermission(viewPermissions, scopeResolver),
  catalogController.categories.bind(catalogController)
);

router.get(
  '/assets',
  requireLogin,
  lendingLocationContext,
  requirePermission(viewPermissions, scopeResolver),
  controller.index.bind(controller)
);
router.get(
  '/assets/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission(viewPermissions, scopeResolver),
  controller.show.bind(controller)
);
router.get(
  '/assets/:id/attachments/:attachmentId/download',
  requireLogin,
  lendingLocationContext,
  requirePermission(viewPermissions, scopeResolver),
  controller.downloadAttachment.bind(controller)
);
router.get(
  '/assets/:id/reserve',
  requireLogin,
  lendingLocationContext,
  requirePermission('loan.create', scopeResolver),
  controller.reserve.bind(controller)
);

module.exports = router;
