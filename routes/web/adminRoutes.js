const express = require('express');
// This module should only orchestrate calls; business rules belong in services.
const requireLogin = require('../../middleware/web/requireLogin');
const requirePermission = require('../../middleware/web/requirePermission');
const lendingLocationContext = require('../../middleware/web/lendingLocationContext');
const resolveLoanScopeMiddleware = require('../../middleware/loanScope');
const validate = require('../../middleware/validation/handleValidation');
const { uploadAssetModelImages, uploadCategoryImage } = require('../../middleware/imageUpload');
const setLendingLocation = require('../../middleware/setLendingLocation');
const { createServices } = require('../../services');
const models = require('../../models');

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
} = require('../../middleware/validation');

const UserAdminController = require('../../controllers/web/admin/userAdminController');
const RoleAdminController = require('../../controllers/web/admin/roleAdminController');
const PermissionAdminController = require('../../controllers/web/admin/permissionAdminController');
const CustomFieldAdminController = require('../../controllers/web/admin/customFieldAdminController');
const CategoryAdminController = require('../../controllers/web/admin/categoryAdminController');
const ManufacturerAdminController = require('../../controllers/web/admin/manufacturerAdminController');
const AssetModelAdminController = require('../../controllers/web/admin/assetModelAdminController');
const AssetInstanceAdminController = require('../../controllers/web/admin/assetInstanceAdminController');
const OpeningHourAdminController = require('../../controllers/web/admin/openingHourAdminController');
const StorageLocationAdminController = require('../../controllers/web/admin/storageLocationAdminController');
const ReservationAdminController = require('../../controllers/web/admin/reservationAdminController');
const LoanAdminController = require('../../controllers/web/admin/loanAdminController');
const LendingUserRoleAdminController = require('../../controllers/web/admin/lendingUserRoleAdminController');
const AdminAssetImportController = require('../../controllers/adminAssetImportController');
const ExportAdminController = require('../../controllers/web/admin/exportAdminController');
const ReportAdminController = require('../../controllers/web/admin/reportAdminController');

const registerInventoryRoutes = require('./admin/modules/inventoryRoutes');
const registerOpeningHourRoutes = require('./admin/modules/openingHoursRoutes');
const registerAdminLoanRoutes = require('./admin/modules/loansRoutes');
const registerRbacRoutes = require('./admin/modules/rbacRoutes');

const router = express.Router();
const services = createServices();
const OPENING_HOUR_ID_PARAM = ':id([0-9a-fA-F-]{36})';
const PERMISSION_KEYS = Object.freeze({
  inventoryManage: 'inventory.manage',
  openingHoursManage: 'openinghours.manage',
  loanManage: 'loan.manage',
  usersManage: 'users.manage',
  rolesManage: 'roles.manage',
  permissionsManage: 'permissions.manage',
  customFieldsManage: 'customfields.manage',
});

// Route helpers.
const resolveLocationScopeOrNull = (req) => req.lendingLocationId || req.body.lendingLocationId || null;
const resolveGlobalScopeOrThrow = () => null;

const middlewareStacks = {
  authenticatedLendingContext: () => [requireLogin, lendingLocationContext],
  inventory: () => [
    requireLogin,
    lendingLocationContext,
    requirePermission(PERMISSION_KEYS.inventoryManage, resolveLocationScopeOrNull),
  ],
  openingHours: () => [
    requireLogin,
    lendingLocationContext,
    requirePermission(PERMISSION_KEYS.openingHoursManage, resolveLocationScopeOrNull),
  ],
  loanScopedLocation: () => [
    requireLogin,
    lendingLocationContext,
    requirePermission(PERMISSION_KEYS.loanManage, resolveLocationScopeOrNull),
  ],
  usersGlobal: () => [
    requireLogin,
    requirePermission(PERMISSION_KEYS.usersManage, resolveGlobalScopeOrThrow),
  ],
  rolesGlobal: () => [
    requireLogin,
    requirePermission(PERMISSION_KEYS.rolesManage, resolveGlobalScopeOrThrow),
  ],
  permissionsGlobal: () => [
    requireLogin,
    requirePermission(PERMISSION_KEYS.permissionsManage, resolveGlobalScopeOrThrow),
  ],
  customFieldsGlobal: () => [
    requireLogin,
    requirePermission(PERMISSION_KEYS.customFieldsManage, resolveGlobalScopeOrThrow),
  ],
};

const requireLendingRoleManagement = (req, res, next) => {
  const lendingLocationId =
    req.lendingLocationId ||
    req.body.lendingLocationId ||
    req.query.lendingLocationId ||
    null;
  const userRoles = Array.isArray(req.userRoles) ? req.userRoles : [];
  const hasSystemAdmin = services.authzService.hasPermission({
    userRoles,
    permissionKey: 'system.admin',
    lendingLocationId: null,
  });
  const hasLendingLocationManage = services.authzService.hasPermission({
    userRoles,
    permissionKey: 'lendinglocations.manage',
    lendingLocationId,
  });
  const hasLoanManage = services.authzService.hasPermission({
    userRoles,
    permissionKey: 'loan.manage',
    lendingLocationId,
  });
  if (!hasSystemAdmin && !(hasLendingLocationManage && hasLoanManage)) {
    return res.redirect('/access-denied');
  }
  return next();
};

// Scope resolvers may hit the DB; cache resolved lendingLocationId on req when possible.
const resolveLoanScope = async (req) => {
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

const resolveOpeningHourScope = async (req) => {
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

const resolveOpeningExceptionScope = async (req) => {
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

// Ownership checks must run before entity lookup to prevent cross-location leakage.
const createOwnedEntityLoader = ({ getEntity, entityName, viewKey }) => async (req, res, next) => {
  try {
    res.locals.viewData = res.locals.viewData || {};
    const entity = await getEntity(req.params.id);
    if (req.lendingLocationId && entity.lendingLocationId !== req.lendingLocationId) {
      const err = new Error(`${entityName} not found`);
      err.status = 404;
      throw err;
    }
    res.locals.viewData[viewKey] = entity;
    return next();
  } catch (err) {
    return next(err);
  }
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

const loadCategoryEditData = createOwnedEntityLoader({
  getEntity: (id) => services.assetCategoryService.getById(id),
  entityName: 'AssetCategory',
  viewKey: 'category',
});

const loadManufacturerEditData = createOwnedEntityLoader({
  getEntity: (id) => services.manufacturerService.getById(id),
  entityName: 'Manufacturer',
  viewKey: 'manufacturer',
});

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
    const componentModelsAll = await services.assetModelService.getAll(
      {
        lendingLocationId: req.lendingLocationId,
        isActive: true,
      },
      { order: [['name', 'ASC']] }
    );
    res.locals.viewData.componentModels = componentModelsAll.filter(
      (entry) => (entry.trackingType || 'serialized') !== 'bundle'
    );

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

const loadStorageLocationEditData = createOwnedEntityLoader({
  getEntity: (id) => services.storageLocationService.getById(id),
  entityName: 'StorageLocation',
  viewKey: 'storageLocation',
});

const loadOpeningHourEditData = createOwnedEntityLoader({
  getEntity: (id) => services.openingHourService.getById(id),
  entityName: 'OpeningHour',
  viewKey: 'hour',
});

const loadOpeningExceptionEditData = createOwnedEntityLoader({
  getEntity: (id) => services.openingExceptionService.getById(id),
  entityName: 'OpeningException',
  viewKey: 'exception',
});

function registerInventoryCrudRoutes({
  basePath,
  controller,
  validationChain,
  newView,
  editView,
  loadEditData,
  createMiddlewares = [],
  updateMiddlewares = [],
}) {
  router.get(
    basePath,
    ...middlewareStacks.inventory(),
    controller.index.bind(controller)
  );
  router.get(
    `${basePath}/new`,
    ...middlewareStacks.inventory(),
    controller.new.bind(controller)
  );
  router.post(
    basePath,
    ...middlewareStacks.inventory(),
    ...createMiddlewares,
    validationChain,
    validate(newView),
    controller.create.bind(controller)
  );
  router.get(
    `${basePath}/:id`,
    ...middlewareStacks.inventory(),
    controller.show.bind(controller)
  );
  router.get(
    `${basePath}/:id/edit`,
    ...middlewareStacks.inventory(),
    loadEditData,
    controller.edit.bind(controller)
  );
  router.post(
    `${basePath}/:id`,
    ...middlewareStacks.inventory(),
    loadEditData,
    ...updateMiddlewares,
    validationChain,
    validate(editView),
    controller.update.bind(controller)
  );
  router.post(
    `${basePath}/:id/delete`,
    ...middlewareStacks.inventory(),
    controller.remove.bind(controller)
  );
  router.post(
    `${basePath}/:id/restore`,
    ...middlewareStacks.inventory(),
    controller.restore.bind(controller)
  );
}

function buildRouteContext() {
  // Route context is DI-only; avoid business logic in this module.
  return {
    router,
    models,
    services,
    middlewareStacks,
    middlewares: {
      requireLogin,
      requirePermission,
      lendingLocationContext,
      resolveLoanScope: resolveLoanScopeMiddleware,
      validate,
      uploadAssetModelImages,
      uploadCategoryImage,
      setLendingLocation,
    },
    permissions: {
      resolveLocationScopeOrNull,
      resolveGlobalScopeOrThrow,
      resolveLoanScope,
      resolveOpeningHourScope,
      resolveOpeningExceptionScope,
    },
    validations: {
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
    },
    controllers: {
      userAdminController: new UserAdminController(),
      roleAdminController: new RoleAdminController(),
      permissionAdminController: new PermissionAdminController(),
      customFieldAdminController: new CustomFieldAdminController(),
      categoryAdminController: new CategoryAdminController(),
      manufacturerAdminController: new ManufacturerAdminController(),
      assetModelAdminController: new AssetModelAdminController(),
      assetInstanceAdminController: new AssetInstanceAdminController(),
      openingHourAdminController: new OpeningHourAdminController(),
      storageLocationAdminController: new StorageLocationAdminController(),
      reservationController: new ReservationAdminController(),
      loanController: new LoanAdminController(),
      lendingUserRoleAdminController: new LendingUserRoleAdminController(),
      assetImportController: new AdminAssetImportController(),
      exportAdminController: new ExportAdminController(),
      reportAdminController: new ReportAdminController(),
    },
    loaders: {
      loadAllRoles,
      loadUserEditData,
      loadAllPermissions,
      loadRoleEditData,
      loadCustomFieldFormData,
      loadCategoryEditData,
      loadManufacturerEditData,
      loadAssetModelFormData,
      loadAssetFormData,
      loadStorageLocationEditData,
      loadOpeningHourEditData,
      loadOpeningExceptionEditData,
    },
    helpers: {
      OPENING_HOUR_ID_PARAM,
      registerInventoryCrudRoutes,
      requireLendingRoleManagement,
    },
  };
}

const routeContext = buildRouteContext();

registerInventoryRoutes(routeContext);
registerOpeningHourRoutes(routeContext);
registerAdminLoanRoutes(routeContext);
registerRbacRoutes(routeContext);

module.exports = router;
