const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi');
const injectUser = require('../../../middleware/web/injectUser');

const users = require('./users');
const roles = require('./roles');
const permissions = require('./permissions');
const authz = require('./authz');
const lendingLocations = require('./lendingLocations');
const openingHours = require('./openingHours');
const openingExceptions = require('./openingExceptions');
const manufacturers = require('./manufacturers');
const assetCategories = require('./assetCategories');
const assetModels = require('./assetModels');
const assets = require('./assets');
const storageLocations = require('./storageLocations');
const assetAttachments = require('./assetAttachments');
const assetMaintenance = require('./assetMaintenance');
const customFieldDefinitions = require('./customFieldDefinitions');
const customFieldValues = require('./customFieldValues');
const loans = require('./loans');
const loanItems = require('./loanItems');
const loanSignatures = require('./loanSignatures');
const loanEvents = require('./loanEvents');
const auditLogs = require('./auditLogs');
const assetsExport = require('./assetsExport');
const assetsImport = require('./assetsImport');

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
