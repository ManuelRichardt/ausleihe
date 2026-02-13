const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi');
const injectUser = require('../../../middlewares/web/injectUser');

const users = require('./users');
const roles = require('./roles');
const permissions = require('./permissions');
const authz = require('./authz');
const lendingLocations = require('./lending-locations');
const openingHours = require('./opening-hours');
const openingExceptions = require('./opening-exceptions');
const manufacturers = require('./manufacturers');
const assetCategories = require('./asset-categories');
const assetModels = require('./asset-models');
const assets = require('./assets');
const storageLocations = require('./storage-locations');
const assetAttachments = require('./asset-attachments');
const assetMaintenance = require('./asset-maintenance');
const customFieldDefinitions = require('./custom-field-definitions');
const customFieldValues = require('./custom-field-values');
const loans = require('./loans');
const loanItems = require('./loan-items');
const loanSignatures = require('./loan-signatures');
const loanEvents = require('./loan-events');
const auditLogs = require('./audit-logs');
const assetsExport = require('./assets-export');
const assetsImport = require('./assets-import');

const router = express.Router();

router.use(injectUser);

router.get('/openapi.json', (req, res) => {
  const doc = openapi && openapi.openapi ? openapi : { openapi: '3.1.0', ...openapi };
  res.json(doc);
});
router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

router.use('/users', users);
router.use('/roles', roles);
router.use('/permissions', permissions);
router.use('/authz', authz);
router.use('/lending-locations', lendingLocations);
router.use('/opening-hours', openingHours);
router.use('/opening-exceptions', openingExceptions);
router.use('/manufacturers', manufacturers);
router.use('/asset-categories', assetCategories);
router.use(assetsExport);
router.use(assetsImport);
router.use('/asset-models', assetModels);
router.use('/assets', assets);
router.use('/storage-locations', storageLocations);
router.use('/asset-attachments', assetAttachments);
router.use('/asset-maintenance', assetMaintenance);
router.use('/custom-field-definitions', customFieldDefinitions);
router.use('/custom-field-values', customFieldValues);
router.use('/loans', loans);
router.use('/loan-items', loanItems);
router.use('/loan-signatures', loanSignatures);
router.use('/loan-events', loanEvents);
router.use('/audit-logs', auditLogs);

module.exports = router;
