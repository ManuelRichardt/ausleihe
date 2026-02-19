const { loginValidation } = require('./authRules');
const { manufacturerValidation } = require('./manufacturerRules');
const { categoryValidation } = require('./categoryRules');
const { assetModelValidation } = require('./assetModelRules');
const { assetValidation } = require('./assetRules');
const {
  customFieldDefinitionValidation,
  customFieldCreateValidation,
  customFieldUpdateValidation,
} = require('./customFieldRules');
const { reservationValidation } = require('./reservationRules');
const { loanValidation, loanSignValidation } = require('./loanRules');
const { userCreateValidation, userUpdateValidation } = require('./userRules');
const { roleValidation } = require('./roleRules');
const { permissionValidation } = require('./permissionRules');
const { openingHoursValidation } = require('./openingHoursRules');
const { openingExceptionValidation } = require('./openingExceptionRules');
const { lendingLocationValidation } = require('./lendingLocationRules');
const { storageLocationValidation } = require('./storageLocationRules');

module.exports = {
  loginValidation,
  manufacturerValidation,
  categoryValidation,
  assetModelValidation,
  assetValidation,
  customFieldDefinitionValidation,
  customFieldCreateValidation,
  customFieldUpdateValidation,
  reservationValidation,
  loanValidation,
  loanSignValidation,
  userCreateValidation,
  userUpdateValidation,
  roleValidation,
  permissionValidation,
  openingHoursValidation,
  openingExceptionValidation,
  lendingLocationValidation,
  storageLocationValidation,
};
