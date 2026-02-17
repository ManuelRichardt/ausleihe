const models = require('../models');

const UserService = require('./UserService');
const RoleService = require('./RoleService');
const PermissionService = require('./PermissionService');
const AuthzService = require('./AuthzService');
const AuthService = require('./AuthService');
const LendingLocationService = require('./LendingLocationService');
const OpeningHourService = require('./OpeningHourService');
const ManufacturerService = require('./ManufacturerService');
const AssetModelService = require('./AssetModelService');
const AssetInstanceService = require('./AssetInstanceService');
const StorageLocationService = require('./StorageLocationService');
const AssetCategoryService = require('./AssetCategoryService');
const InventoryStockService = require('./InventoryStockService');
const BundleService = require('./BundleService');
const AssetAttachmentService = require('./AssetAttachmentService');
const AssetMaintenanceService = require('./AssetMaintenanceService');
const LoanEventService = require('./LoanEventService');
const OpeningExceptionService = require('./OpeningExceptionService');
const CustomFieldDefinitionService = require('./CustomFieldDefinitionService');
const CustomFieldValueService = require('./CustomFieldValueService');
const LoanService = require('./LoanService');
const LoanItemService = require('./LoanItemService');
const LoanSignatureService = require('./LoanSignatureService');
const AuditLogService = require('./AuditLogService');
const ConfigService = require('./ConfigService');
const AuthSessionService = require('./AuthSessionService');
const LocalAuthService = require('./LocalAuthService');
const SamlAuthService = require('./SamlAuthService');
const LdapAuthService = require('./LdapAuthService');
const SamlProvisioningService = require('./SamlProvisioningService');
const LdapProvisioningService = require('./LdapProvisioningService');
const AvailabilityService = require('./AvailabilityService');
const CartService = require('./CartService');
const ReservationPortalService = require('./ReservationPortalService');
const LoanPortalService = require('./LoanPortalService');
const ReportService = require('./ReportService');
const UiTextService = require('./UiTextService');
const MailConfigService = require('./MailConfigService');
const MailTemplateService = require('./MailTemplateService');
const NotificationService = require('./NotificationService');
const MailService = require('./MailService');
const PrivacyService = require('./PrivacyService');

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
