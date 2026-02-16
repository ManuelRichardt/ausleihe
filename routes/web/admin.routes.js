const express = require('express');
const requireLogin = require('../../middlewares/web/requireLogin');
const requirePermission = require('../../middlewares/web/requirePermission');
const lendingLocationContext = require('../../middlewares/web/lendingLocationContext');
const resolveLoanScope = require('../../middleware/loanScope');
const validate = require('../../middleware/validate');
const uploadAssetModelImages = require('../../middleware/assetModelImagesUpload');
const uploadCategoryImage = require('../../middleware/categoryImageUpload');
const {
  userCreateValidation,
  userUpdateValidation,
  roleValidation,
  permissionValidation,
  customFieldCreateValidation,
  customFieldUpdateValidation,
  categoryValidation,
  manufacturerValidation,
  assetModelValidation,
  assetValidation,
  openingHoursValidation,
  openingExceptionValidation,
  storageLocationValidation,
} = require('../../validation');
const setLendingLocation = require('../../middleware/setLendingLocation');
const { createServices } = require('../../services');
const models = require('../../models');
const UserAdminController = require('../../controllers/web/admin/UserAdminController');
const RoleAdminController = require('../../controllers/web/admin/RoleAdminController');
const PermissionAdminController = require('../../controllers/web/admin/PermissionAdminController');
const CustomFieldAdminController = require('../../controllers/web/admin/CustomFieldAdminController');
const CategoryAdminController = require('../../controllers/web/admin/CategoryAdminController');
const ManufacturerAdminController = require('../../controllers/web/admin/ManufacturerAdminController');
const AssetModelAdminController = require('../../controllers/web/admin/AssetModelAdminController');
const AssetInstanceAdminController = require('../../controllers/web/admin/AssetInstanceAdminController');
const OpeningHourAdminController = require('../../controllers/web/admin/OpeningHourAdminController');
const StorageLocationAdminController = require('../../controllers/web/admin/StorageLocationAdminController');
const ReservationAdminController = require('../../controllers/web/admin/ReservationAdminController');
const LoanAdminController = require('../../controllers/web/admin/LoanAdminController');
const LendingUserRoleAdminController = require('../../controllers/web/admin/LendingUserRoleAdminController');
const AdminAssetImportController = require('../../controllers/AdminAssetImportController');
const ExportAdminController = require('../../controllers/web/admin/ExportAdminController');
const ReportAdminController = require('../../controllers/web/admin/ReportAdminController');

const router = express.Router();
const locationScope = (req) => req.lendingLocationId || req.body.lendingLocationId || null;
const globalScope = () => null;
const userAdminController = new UserAdminController();
const roleAdminController = new RoleAdminController();
const permissionAdminController = new PermissionAdminController();
const customFieldAdminController = new CustomFieldAdminController();
const categoryAdminController = new CategoryAdminController();
const manufacturerAdminController = new ManufacturerAdminController();
const assetModelAdminController = new AssetModelAdminController();
const assetInstanceAdminController = new AssetInstanceAdminController();
const openingHourAdminController = new OpeningHourAdminController();
const storageLocationAdminController = new StorageLocationAdminController();
const reservationController = new ReservationAdminController();
const loanController = new LoanAdminController();
const lendingUserRoleAdminController = new LendingUserRoleAdminController();
const assetImportController = new AdminAssetImportController();
const exportAdminController = new ExportAdminController();
const reportAdminController = new ReportAdminController();
const services = createServices();
const OPENING_HOUR_ID_PARAM = ':id([0-9a-fA-F-]{36})';

const loanScope = async (req) => {
  if (req.loanScopeLendingLocationId) {
    return req.loanScopeLendingLocationId;
  }
  if (req.params && req.params.id) {
    try {
      const loan = await models.Loan.findByPk(req.params.id, { attributes: ['lendingLocationId'] });
      return loan && loan.lendingLocationId ? loan.lendingLocationId : (req.lendingLocationId || null);
    } catch (err) {
      return req.lendingLocationId || null;
    }
  }
  return req.lendingLocationId || null;
};

const openingHourScope = async (req) => {
  if (req.openingHourScopeLendingLocationId) {
    return req.openingHourScopeLendingLocationId;
  }
  if (req.params && req.params.id) {
    try {
      const openingHour = await models.OpeningHour.findByPk(req.params.id, {
        attributes: ['lendingLocationId'],
        paranoid: false,
      });
      if (openingHour && openingHour.lendingLocationId) {
        return openingHour.lendingLocationId;
      }
    } catch (err) {
      // fallback below
    }
  }
  return req.body.lendingLocationId || req.lendingLocationId || null;
};

const openingExceptionScope = async (req) => {
  if (req.openingExceptionScopeLendingLocationId) {
    return req.openingExceptionScopeLendingLocationId;
  }
  if (req.params && req.params.id) {
    try {
      const openingException = await models.OpeningException.findByPk(req.params.id, {
        attributes: ['lendingLocationId'],
        paranoid: false,
      });
      if (openingException && openingException.lendingLocationId) {
        return openingException.lendingLocationId;
      }
    } catch (err) {
      // fallback below
    }
  }
  return req.body.lendingLocationId || req.lendingLocationId || null;
};

async function loadAllRoles(req, res, next) {
  try {
    res.locals.viewData = res.locals.viewData || {};
    res.locals.viewData.allRoles = await services.roleService.getAll();
    res.locals.viewData.lendingLocations = await services.lendingLocationService.getAll();
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadUserEditData(req, res, next) {
  try {
    res.locals.viewData = res.locals.viewData || {};
    const user = await services.userService.getById(req.params.id);
    const userRoles = await services.userService.listUserRoles(req.params.id);
    const allRoles = await services.roleService.getAll();
    const lendingLocations = await services.lendingLocationService.getAll();
    res.locals.viewData.user = user;
    res.locals.viewData.userRoles = userRoles;
    res.locals.viewData.allRoles = allRoles;
    res.locals.viewData.lendingLocations = lendingLocations;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadAllPermissions(req, res, next) {
  try {
    res.locals.viewData = res.locals.viewData || {};
    res.locals.viewData.permissions = await services.permissionService.getAll();
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadRoleEditData(req, res, next) {
  try {
    res.locals.viewData = res.locals.viewData || {};
    res.locals.viewData.role = await services.roleService.getByIdWithPermissions(req.params.id);
    res.locals.viewData.permissions = await services.permissionService.getAll();
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadCustomFieldFormData(req, res, next) {
  try {
    res.locals.viewData = res.locals.viewData || {};
    if (req.params.id) {
      res.locals.viewData.customField = await services.customFieldDefinitionService.getById(req.params.id);
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadCategoryEditData(req, res, next) {
  try {
    res.locals.viewData = res.locals.viewData || {};
    const category = await services.assetCategoryService.getById(req.params.id);
    if (req.lendingLocationId && category.lendingLocationId !== req.lendingLocationId) {
      const err = new Error('AssetCategory not found');
      err.status = 404;
      throw err;
    }
    res.locals.viewData.category = category;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadManufacturerEditData(req, res, next) {
  try {
    res.locals.viewData = res.locals.viewData || {};
    const manufacturer = await services.manufacturerService.getById(req.params.id);
    if (req.lendingLocationId && manufacturer.lendingLocationId !== req.lendingLocationId) {
      const err = new Error('Manufacturer not found');
      err.status = 404;
      throw err;
    }
    res.locals.viewData.manufacturer = manufacturer;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadAssetModelFormData(req, res, next) {
  try {
    res.locals.viewData = res.locals.viewData || {};
    res.locals.viewData.manufacturers = await services.manufacturerService.getAll({
      lendingLocationId: req.lendingLocationId,
      isActive: true,
    });
    res.locals.viewData.categories = await services.assetCategoryService.getAll({
      lendingLocationId: req.lendingLocationId,
      isActive: true,
    });
    res.locals.viewData.customFieldDefinitions = await services.assetModelService.getGlobalCustomFieldDefinitions({
      onlyActive: true,
    });
    const componentModelsAll = await services.assetModelService.getAll({
      lendingLocationId: req.lendingLocationId,
      isActive: true,
    }, { order: [['name', 'ASC']] });
    res.locals.viewData.componentModels = componentModelsAll.filter((entry) => (entry.trackingType || 'serialized') !== 'bundle');
    if (req.params.id) {
      const model = await services.assetModelService.getById(req.params.id);
      if (req.lendingLocationId && model.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetModel not found');
        err.status = 404;
        throw err;
      }
      res.locals.viewData.model = model;
      res.locals.viewData.stock = await services.inventoryStockService.getStock(model.id, model.lendingLocationId);
      res.locals.viewData.bundleDefinition = await services.bundleService.getByAssetModel(model.id, model.lendingLocationId);
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadAssetFormData(req, res, next) {
  try {
    res.locals.viewData = res.locals.viewData || {};
    res.locals.viewData.models = await services.assetModelService.getAll({
      lendingLocationId: req.lendingLocationId,
      isActive: true,
    });
    res.locals.viewData.storageLocations = await services.storageLocationService.getAll({
      lendingLocationId: req.lendingLocationId,
      isActive: true,
    });
    if (req.params.id) {
      const asset = await services.assetInstanceService.getById(req.params.id);
      if (req.lendingLocationId && asset.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('Asset not found');
        err.status = 404;
        throw err;
      }
      res.locals.viewData.asset = asset;
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadStorageLocationEditData(req, res, next) {
  try {
    res.locals.viewData = res.locals.viewData || {};
    const storageLocation = await services.storageLocationService.getById(req.params.id);
    if (req.lendingLocationId && storageLocation.lendingLocationId !== req.lendingLocationId) {
      const err = new Error('StorageLocation not found');
      err.status = 404;
      throw err;
    }
    res.locals.viewData.storageLocation = storageLocation;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadOpeningHourEditData(req, res, next) {
  try {
    res.locals.viewData = res.locals.viewData || {};
    const hour = await services.openingHourService.getById(req.params.id);
    if (req.lendingLocationId && hour.lendingLocationId !== req.lendingLocationId) {
      const err = new Error('OpeningHour not found');
      err.status = 404;
      throw err;
    }
    res.locals.viewData.hour = hour;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadOpeningExceptionEditData(req, res, next) {
  try {
    res.locals.viewData = res.locals.viewData || {};
    const exception = await services.openingExceptionService.getById(req.params.id);
    if (req.lendingLocationId && exception.lendingLocationId !== req.lendingLocationId) {
      const err = new Error('OpeningException not found');
      err.status = 404;
      throw err;
    }
    res.locals.viewData.exception = exception;
    return next();
  } catch (err) {
    return next(err);
  }
}

router.get(
  '/admin/categories',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  categoryAdminController.index.bind(categoryAdminController)
);
router.get(
  '/admin/categories/new',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  categoryAdminController.new.bind(categoryAdminController)
);
router.post(
  '/admin/categories',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  uploadCategoryImage,
  categoryValidation,
  validate('admin/categories/new'),
  categoryAdminController.create.bind(categoryAdminController)
);
router.get(
  '/admin/categories/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  categoryAdminController.show.bind(categoryAdminController)
);
router.get(
  '/admin/categories/:id/edit',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  loadCategoryEditData,
  categoryAdminController.edit.bind(categoryAdminController)
);
router.post(
  '/admin/categories/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  loadCategoryEditData,
  uploadCategoryImage,
  categoryValidation,
  validate('admin/categories/edit'),
  categoryAdminController.update.bind(categoryAdminController)
);
router.post(
  '/admin/categories/:id/delete',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  categoryAdminController.remove.bind(categoryAdminController)
);
router.post(
  '/admin/categories/:id/restore',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  categoryAdminController.restore.bind(categoryAdminController)
);

router.get(
  '/admin/manufacturers',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  manufacturerAdminController.index.bind(manufacturerAdminController)
);
router.get(
  '/admin/manufacturers/new',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  manufacturerAdminController.new.bind(manufacturerAdminController)
);
router.post(
  '/admin/manufacturers',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  manufacturerValidation,
  validate('admin/manufacturers/new'),
  manufacturerAdminController.create.bind(manufacturerAdminController)
);
router.get(
  '/admin/manufacturers/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  manufacturerAdminController.show.bind(manufacturerAdminController)
);
router.get(
  '/admin/manufacturers/:id/edit',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  loadManufacturerEditData,
  manufacturerAdminController.edit.bind(manufacturerAdminController)
);
router.post(
  '/admin/manufacturers/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  loadManufacturerEditData,
  manufacturerValidation,
  validate('admin/manufacturers/edit'),
  manufacturerAdminController.update.bind(manufacturerAdminController)
);
router.post(
  '/admin/manufacturers/:id/delete',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  manufacturerAdminController.remove.bind(manufacturerAdminController)
);
router.post(
  '/admin/manufacturers/:id/restore',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  manufacturerAdminController.restore.bind(manufacturerAdminController)
);

router.get(
  '/admin/asset-models',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetModelAdminController.index.bind(assetModelAdminController)
);
router.get(
  '/admin/asset-models/new',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  loadAssetModelFormData,
  assetModelAdminController.new.bind(assetModelAdminController)
);
router.post(
  '/admin/asset-models',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  setLendingLocation,
  uploadAssetModelImages,
  loadAssetModelFormData,
  assetModelValidation,
  validate('admin/models/new'),
  assetModelAdminController.create.bind(assetModelAdminController)
);
router.get(
  '/admin/asset-models/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetModelAdminController.show.bind(assetModelAdminController)
);
router.get(
  '/admin/asset-models/:id/edit',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  loadAssetModelFormData,
  assetModelAdminController.edit.bind(assetModelAdminController)
);
router.post(
  '/admin/asset-models/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  setLendingLocation,
  uploadAssetModelImages,
  loadAssetModelFormData,
  assetModelValidation,
  validate('admin/models/edit'),
  assetModelAdminController.update.bind(assetModelAdminController)
);
router.post(
  '/admin/asset-models/:id/delete',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetModelAdminController.remove.bind(assetModelAdminController)
);
router.post(
  '/admin/asset-models/:id/restore',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetModelAdminController.restore.bind(assetModelAdminController)
);
router.post(
  '/admin/asset-models/:id/stock',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetModelAdminController.updateStock.bind(assetModelAdminController)
);
router.post(
  '/admin/asset-models/:id/attachments/:attachmentId',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetModelAdminController.updateAttachment.bind(assetModelAdminController)
);
router.post(
  '/admin/asset-models/:id/attachments/:attachmentId/delete',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetModelAdminController.removeAttachment.bind(assetModelAdminController)
);

router.get(
  '/admin/assets',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetInstanceAdminController.index.bind(assetInstanceAdminController)
);
router.get(
  '/admin/assets/new',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  loadAssetFormData,
  assetInstanceAdminController.new.bind(assetInstanceAdminController)
);
router.post(
  '/admin/assets',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  setLendingLocation,
  loadAssetFormData,
  assetValidation,
  validate('admin/assets/new'),
  assetInstanceAdminController.create.bind(assetInstanceAdminController)
);
router.get(
  '/admin/assets/import',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetImportController.renderImportPage.bind(assetImportController)
);
router.post(
  '/admin/assets/import',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetImportController.uploadMiddleware,
  assetImportController.executeImport.bind(assetImportController)
);

router.get(
  '/admin/exports',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  exportAdminController.index.bind(exportAdminController)
);
router.get(
  '/admin/reports',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  reportAdminController.index.bind(reportAdminController)
);
router.get(
  '/admin/reports/inventory.pdf',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  reportAdminController.inventoryPdf.bind(reportAdminController)
);
router.get(
  '/admin/reports/maintenance.pdf',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  reportAdminController.maintenancePdf.bind(reportAdminController)
);
router.get(
  '/admin/reports/labels.pdf',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  reportAdminController.labelsPdf.bind(reportAdminController)
);
router.get(
  '/admin/assets/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetInstanceAdminController.show.bind(assetInstanceAdminController)
);
router.get(
  '/admin/assets/:id/edit',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  loadAssetFormData,
  assetInstanceAdminController.edit.bind(assetInstanceAdminController)
);
router.post(
  '/admin/assets/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  setLendingLocation,
  loadAssetFormData,
  assetValidation,
  validate('admin/assets/edit'),
  assetInstanceAdminController.update.bind(assetInstanceAdminController)
);
router.post(
  '/admin/assets/:id/delete',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetInstanceAdminController.remove.bind(assetInstanceAdminController)
);
router.post(
  '/admin/assets/:id/restore',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetInstanceAdminController.restore.bind(assetInstanceAdminController)
);
router.post(
  '/admin/assets/:id/maintenance/report',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetInstanceAdminController.reportMaintenance.bind(assetInstanceAdminController)
);
router.post(
  '/admin/assets/:id/maintenance/:maintenanceId/start',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetInstanceAdminController.startMaintenance.bind(assetInstanceAdminController)
);
router.post(
  '/admin/assets/:id/maintenance/:maintenanceId/complete',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  assetInstanceAdminController.completeMaintenance.bind(assetInstanceAdminController)
);

router.get(
  '/admin/storage-locations',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  storageLocationAdminController.index.bind(storageLocationAdminController)
);
router.get(
  '/admin/storage-locations/new',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  storageLocationAdminController.new.bind(storageLocationAdminController)
);
router.post(
  '/admin/storage-locations',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  storageLocationValidation,
  validate('admin/storage-locations/new'),
  storageLocationAdminController.create.bind(storageLocationAdminController)
);
router.get(
  '/admin/storage-locations/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  storageLocationAdminController.show.bind(storageLocationAdminController)
);
router.get(
  '/admin/storage-locations/:id/edit',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  loadStorageLocationEditData,
  storageLocationAdminController.edit.bind(storageLocationAdminController)
);
router.post(
  '/admin/storage-locations/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  loadStorageLocationEditData,
  storageLocationValidation,
  validate('admin/storage-locations/edit'),
  storageLocationAdminController.update.bind(storageLocationAdminController)
);
router.post(
  '/admin/storage-locations/:id/delete',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  storageLocationAdminController.remove.bind(storageLocationAdminController)
);
router.post(
  '/admin/storage-locations/:id/restore',
  requireLogin,
  lendingLocationContext,
  requirePermission('inventory.manage', locationScope),
  storageLocationAdminController.restore.bind(storageLocationAdminController)
);
router.get(
  '/admin/custom-fields',
  requireLogin,
  requirePermission('customfields.manage', globalScope),
  customFieldAdminController.index.bind(customFieldAdminController)
);
router.get(
  '/admin/custom-fields/new',
  requireLogin,
  requirePermission('customfields.manage', globalScope),
  loadCustomFieldFormData,
  customFieldAdminController.new.bind(customFieldAdminController)
);
router.post(
  '/admin/custom-fields',
  requireLogin,
  requirePermission('customfields.manage', globalScope),
  loadCustomFieldFormData,
  customFieldCreateValidation,
  validate('admin/custom-fields/new'),
  customFieldAdminController.create.bind(customFieldAdminController)
);
router.get(
  '/admin/custom-fields/:id/edit',
  requireLogin,
  requirePermission('customfields.manage', globalScope),
  loadCustomFieldFormData,
  customFieldAdminController.edit.bind(customFieldAdminController)
);
router.post(
  '/admin/custom-fields/:id',
  requireLogin,
  requirePermission('customfields.manage', globalScope),
  loadCustomFieldFormData,
  customFieldUpdateValidation,
  validate('admin/custom-fields/edit'),
  customFieldAdminController.update.bind(customFieldAdminController)
);
router.post(
  '/admin/custom-fields/:id/delete',
  requireLogin,
  requirePermission('customfields.manage', globalScope),
  customFieldAdminController.remove.bind(customFieldAdminController)
);
router.get(
  '/admin/opening-hours',
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', locationScope),
  openingHourAdminController.index.bind(openingHourAdminController)
);

router.get(
  '/admin/reservations',
  requireLogin,
  lendingLocationContext,
  requirePermission('loan.manage', locationScope),
  reservationController.index.bind(reservationController)
);
router.get(
  '/admin/reservations/:id',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', loanScope),
  reservationController.show.bind(reservationController)
);
router.post(
  '/admin/reservations/:id/cancel',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', loanScope),
  reservationController.cancel.bind(reservationController)
);

router.get(
  '/admin/loans',
  requireLogin,
  lendingLocationContext,
  requirePermission('loan.manage', locationScope),
  loanController.index.bind(loanController)
);
router.get(
  '/admin/loans/:id',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', loanScope),
  loanController.show.bind(loanController)
);
router.post(
  '/admin/loans/:id/period',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', loanScope),
  loanController.updatePeriod.bind(loanController)
);
router.get(
  '/admin/loans/:id/return',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', loanScope),
  loanController.showReturn.bind(loanController)
);
router.post(
  '/admin/loans/:id/hand-over',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', loanScope),
  loanController.handOver.bind(loanController)
);
router.post(
  '/admin/loans/:id/return',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', loanScope),
  loanController.returnLoan.bind(loanController)
);
router.post(
  '/admin/loans/:id/return-items',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', loanScope),
  loanController.returnItems.bind(loanController)
);
router.post(
  '/admin/loans/:id/items',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', loanScope),
  loanController.addItem.bind(loanController)
);
router.get(
  '/admin/loans/:id/models/search',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', loanScope),
  loanController.searchModels.bind(loanController)
);
router.post(
  '/admin/loans/:id/items/:itemId/model',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', loanScope),
  loanController.updateItemModel.bind(loanController)
);
router.post(
  '/admin/loans/:id/items/:itemId/delete',
  requireLogin,
  lendingLocationContext,
  resolveLoanScope,
  requirePermission('loan.manage', loanScope),
  loanController.removeItem.bind(loanController)
);
router.get(
  '/admin/opening-hours/new',
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', locationScope),
  openingHourAdminController.new.bind(openingHourAdminController)
);
router.post(
  '/admin/opening-hours',
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', locationScope),
  openingHoursValidation,
  validate('admin/opening-hours/new'),
  openingHourAdminController.create.bind(openingHourAdminController)
);
router.get(
  `/admin/opening-hours/${OPENING_HOUR_ID_PARAM}`,
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', openingHourScope),
  openingHourAdminController.show.bind(openingHourAdminController)
);
router.get(
  `/admin/opening-hours/${OPENING_HOUR_ID_PARAM}/edit`,
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', openingHourScope),
  loadOpeningHourEditData,
  openingHourAdminController.edit.bind(openingHourAdminController)
);
router.post(
  `/admin/opening-hours/${OPENING_HOUR_ID_PARAM}`,
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', openingHourScope),
  loadOpeningHourEditData,
  openingHoursValidation,
  validate('admin/opening-hours/edit'),
  openingHourAdminController.update.bind(openingHourAdminController)
);
router.post(
  `/admin/opening-hours/${OPENING_HOUR_ID_PARAM}/delete`,
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', openingHourScope),
  openingHourAdminController.remove.bind(openingHourAdminController)
);
router.post(
  `/admin/opening-hours/${OPENING_HOUR_ID_PARAM}/restore`,
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', openingHourScope),
  openingHourAdminController.restore.bind(openingHourAdminController)
);
router.get(
  '/admin/opening-hours/exceptions/new',
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', locationScope),
  openingHourAdminController.newException.bind(openingHourAdminController)
);
router.post(
  '/admin/opening-hours/exceptions',
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', locationScope),
  openingExceptionValidation,
  validate('admin/opening-hours/exceptions/new'),
  openingHourAdminController.createException.bind(openingHourAdminController)
);
router.get(
  '/admin/opening-hours/exceptions/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', openingExceptionScope),
  openingHourAdminController.showException.bind(openingHourAdminController)
);
router.get(
  '/admin/opening-hours/exceptions/:id/edit',
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', openingExceptionScope),
  loadOpeningExceptionEditData,
  openingHourAdminController.editException.bind(openingHourAdminController)
);
router.post(
  '/admin/opening-hours/exceptions/:id',
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', openingExceptionScope),
  loadOpeningExceptionEditData,
  openingExceptionValidation,
  validate('admin/opening-hours/exceptions/edit'),
  openingHourAdminController.updateException.bind(openingHourAdminController)
);
router.post(
  '/admin/opening-hours/exceptions/:id/delete',
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', openingExceptionScope),
  openingHourAdminController.removeException.bind(openingHourAdminController)
);
router.post(
  '/admin/opening-hours/exceptions/:id/restore',
  requireLogin,
  lendingLocationContext,
  requirePermission('openinghours.manage', openingExceptionScope),
  openingHourAdminController.restoreException.bind(openingHourAdminController)
);
router.get(
  '/admin/lending-user-roles',
  requireLogin,
  lendingLocationContext,
  requirePermission('admin.access', locationScope),
  lendingUserRoleAdminController.index.bind(lendingUserRoleAdminController)
);
router.post(
  '/admin/lending-user-roles/:id/roles/assign',
  requireLogin,
  lendingLocationContext,
  requirePermission('admin.access', locationScope),
  lendingUserRoleAdminController.assign.bind(lendingUserRoleAdminController)
);
router.post(
  '/admin/lending-user-roles/:id/roles/:roleId/revoke',
  requireLogin,
  lendingLocationContext,
  requirePermission('admin.access', locationScope),
  lendingUserRoleAdminController.revoke.bind(lendingUserRoleAdminController)
);
router.get(
  '/admin/users',
  requireLogin,
  requirePermission('users.manage', globalScope),
  userAdminController.index.bind(userAdminController)
);
router.get(
  '/admin/users/new',
  requireLogin,
  requirePermission('users.manage', globalScope),
  loadAllRoles,
  userAdminController.new.bind(userAdminController)
);
router.post(
  '/admin/users',
  requireLogin,
  requirePermission('users.manage', globalScope),
  loadAllRoles,
  userCreateValidation,
  validate('admin/users/new'),
  userAdminController.create.bind(userAdminController)
);
router.post(
  '/admin/users/bulk',
  requireLogin,
  requirePermission('users.manage', globalScope),
  userAdminController.bulk.bind(userAdminController)
);
router.get(
  '/admin/roles',
  requireLogin,
  requirePermission('roles.manage', globalScope),
  roleAdminController.index.bind(roleAdminController)
);
router.get(
  '/admin/roles/new',
  requireLogin,
  requirePermission('roles.manage', globalScope),
  loadAllPermissions,
  roleAdminController.new.bind(roleAdminController)
);
router.post(
  '/admin/roles',
  requireLogin,
  requirePermission('roles.manage', globalScope),
  loadAllPermissions,
  roleValidation,
  validate('admin/roles/new'),
  roleAdminController.create.bind(roleAdminController)
);
router.get(
  '/admin/roles/:id/edit',
  requireLogin,
  requirePermission('roles.manage', globalScope),
  loadRoleEditData,
  roleAdminController.edit.bind(roleAdminController)
);
router.post(
  '/admin/roles/:id',
  requireLogin,
  requirePermission('roles.manage', globalScope),
  loadRoleEditData,
  roleValidation,
  validate('admin/roles/edit'),
  roleAdminController.update.bind(roleAdminController)
);
router.post(
  '/admin/roles/:id/delete',
  requireLogin,
  requirePermission('roles.manage', globalScope),
  roleAdminController.remove.bind(roleAdminController)
);
router.post(
  '/admin/roles/:id/restore',
  requireLogin,
  requirePermission('roles.manage', globalScope),
  roleAdminController.restore.bind(roleAdminController)
);
router.get(
  '/admin/permissions',
  requireLogin,
  requirePermission('permissions.manage', globalScope),
  permissionAdminController.index.bind(permissionAdminController)
);
router.get(
  '/admin/permissions/new',
  requireLogin,
  requirePermission('permissions.manage', globalScope),
  permissionAdminController.new.bind(permissionAdminController)
);
router.post(
  '/admin/permissions',
  requireLogin,
  requirePermission('permissions.manage', globalScope),
  permissionValidation,
  validate('admin/permissions/new'),
  permissionAdminController.create.bind(permissionAdminController)
);
router.get(
  '/admin/permissions/:id/edit',
  requireLogin,
  requirePermission('permissions.manage', globalScope),
  permissionAdminController.edit.bind(permissionAdminController)
);
router.post(
  '/admin/permissions/:id',
  requireLogin,
  requirePermission('permissions.manage', globalScope),
  permissionValidation,
  validate('admin/permissions/edit'),
  permissionAdminController.update.bind(permissionAdminController)
);
router.post(
  '/admin/permissions/:id/delete',
  requireLogin,
  requirePermission('permissions.manage', globalScope),
  permissionAdminController.remove.bind(permissionAdminController)
);
router.get(
  '/admin/users/:id',
  requireLogin,
  requirePermission('users.manage', globalScope),
  userAdminController.show.bind(userAdminController)
);
router.post(
  '/admin/users/:id/roles',
  requireLogin,
  requirePermission('users.manage', globalScope),
  userAdminController.assignRoleFromDetail.bind(userAdminController)
);
router.get(
  '/admin/users/:id/edit',
  requireLogin,
  requirePermission('users.manage', globalScope),
  loadUserEditData,
  userAdminController.edit.bind(userAdminController)
);
router.post(
  '/admin/users/:id',
  requireLogin,
  requirePermission('users.manage', globalScope),
  loadUserEditData,
  userUpdateValidation,
  validate('admin/users/edit'),
  userAdminController.update.bind(userAdminController)
);
router.post(
  '/admin/users/:id/delete',
  requireLogin,
  requirePermission('users.manage', globalScope),
  userAdminController.remove.bind(userAdminController)
);
router.post(
  '/admin/users/:id/restore',
  requireLogin,
  requirePermission('users.manage', globalScope),
  userAdminController.restore.bind(userAdminController)
);

router.post(
  '/admin/custom-fields/:id/restore',
  requireLogin,
  requirePermission('customfields.manage', globalScope),
  customFieldAdminController.restore.bind(customFieldAdminController)
);

module.exports = router;
