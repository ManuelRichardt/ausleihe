const models = require('../models');

const UserService = require('./userService');
const RoleService = require('./roleService');
const PermissionService = require('./permissionService');
const AuthzService = require('./authzService');
const AuthService = require('./authService');
const LendingLocationService = require('./lendingLocationService');
const OpeningHourService = require('./openingHourService');
const ManufacturerService = require('./manufacturerService');
const AssetModelService = require('./assetModelService');
const AssetInstanceService = require('./assetInstanceService');
const StorageLocationService = require('./storageLocationService');
const AssetCategoryService = require('./assetCategoryService');
const InventoryStockService = require('./inventoryStockService');
const BundleService = require('./bundleService');
const AssetAttachmentService = require('./assetAttachmentService');
const AssetMaintenanceService = require('./assetMaintenanceService');
const LoanEventService = require('./loanEventService');
const OpeningExceptionService = require('./openingExceptionService');
const CustomFieldDefinitionService = require('./customFieldDefinitionService');
const CustomFieldValueService = require('./customFieldValueService');
const LoanService = require('./loanService');
const LoanItemService = require('./loanItemService');
const LoanSignatureService = require('./loanSignatureService');
const AuditLogService = require('./auditLogService');
const ConfigService = require('./configService');
const AuthSessionService = require('./authSessionService');
const LocalAuthService = require('./localAuthService');
const SamlAuthService = require('./samlAuthService');
const LdapAuthService = require('./ldapAuthService');
const SamlProvisioningService = require('./samlProvisioningService');
const LdapProvisioningService = require('./ldapProvisioningService');
const AvailabilityService = require('./availabilityService');
const CartService = require('./cartService');
const ReservationPortalService = require('./reservationPortalService');
const LoanPortalService = require('./loanPortalService');
const ReportService = require('./reportService');
const UiTextService = require('./uiTextService');
const MailConfigService = require('./mailConfigService');
const MailTemplateService = require('./mailTemplateService');
const NotificationService = require('./notificationService');
const MailService = require('./mailService');
const PrivacyService = require('./privacyService');

function createServices(customModels = models) {
  const availabilityService = new AvailabilityService(customModels);
  const loanService = new LoanService(customModels, availabilityService);
  const assetModelService = new AssetModelService(customModels);
  const assetInstanceService = new AssetInstanceService(customModels);
  const inventoryStockService = new InventoryStockService(customModels);
  const bundleService = new BundleService(customModels, availabilityService, inventoryStockService);
  const mailConfigService = new MailConfigService(customModels);
  const mailTemplateService = new MailTemplateService(customModels);
  const notificationService = new NotificationService(customModels);
  const privacyService = new PrivacyService(customModels);
  return {
    authService: new AuthService(customModels),
    userService: new UserService(customModels),
    roleService: new RoleService(customModels),
    permissionService: new PermissionService(customModels),
    authzService: new AuthzService(customModels),
    lendingLocationService: new LendingLocationService(customModels),
    openingHourService: new OpeningHourService(customModels),
    manufacturerService: new ManufacturerService(customModels),
    assetModelService,
    assetInstanceService,
    storageLocationService: new StorageLocationService(customModels),
    assetCategoryService: new AssetCategoryService(customModels),
    inventoryStockService,
    bundleService,
    assetAttachmentService: new AssetAttachmentService(customModels),
    assetMaintenanceService: new AssetMaintenanceService(customModels),
    loanEventService: new LoanEventService(customModels),
    openingExceptionService: new OpeningExceptionService(customModels),
    customFieldDefinitionService: new CustomFieldDefinitionService(customModels),
    customFieldValueService: new CustomFieldValueService(customModels),
    loanService,
    loanItemService: new LoanItemService(customModels),
    loanSignatureService: new LoanSignatureService(customModels),
    auditLogService: new AuditLogService(customModels),
    configService: new ConfigService(customModels),
    authSessionService: new AuthSessionService(customModels),
    localAuthService: new LocalAuthService(customModels),
    samlAuthService: new SamlAuthService(customModels),
    ldapAuthService: new LdapAuthService(customModels),
    samlProvisioningService: new SamlProvisioningService(customModels),
    ldapProvisioningService: new LdapProvisioningService(customModels),
    availabilityService,
    cartService: new CartService(customModels, availabilityService, bundleService, inventoryStockService),
    reservationPortalService: new ReservationPortalService(customModels, loanService),
    loanPortalService: new LoanPortalService(
      customModels,
      loanService,
      assetModelService,
      assetInstanceService
    ),
    reportService: new ReportService(customModels),
    uiTextService: new UiTextService(customModels),
    mailConfigService,
    mailTemplateService,
    notificationService,
    mailService: new MailService(customModels, mailConfigService, mailTemplateService, notificationService),
    privacyService,
  };
}

module.exports = {
  createServices,
  UserService,
  RoleService,
  PermissionService,
  AuthzService,
  LendingLocationService,
  OpeningHourService,
  ManufacturerService,
  AssetModelService,
  AssetInstanceService,
  StorageLocationService,
  AssetCategoryService,
  InventoryStockService,
  BundleService,
  AssetAttachmentService,
  AssetMaintenanceService,
  LoanEventService,
  OpeningExceptionService,
  CustomFieldDefinitionService,
  CustomFieldValueService,
  LoanService,
  LoanItemService,
  LoanSignatureService,
  AuditLogService,
  AuthService,
  ConfigService,
  AuthSessionService,
  LocalAuthService,
  SamlAuthService,
  LdapAuthService,
  SamlProvisioningService,
  LdapProvisioningService,
  AvailabilityService,
  CartService,
  ReservationPortalService,
  LoanPortalService,
  ReportService,
  UiTextService,
  MailConfigService,
  MailTemplateService,
  NotificationService,
  MailService,
  PrivacyService,
};
