const { loginValidation } = require('./auth.validation');
const { manufacturerValidation } = require('./manufacturer.validation');
const { categoryValidation } = require('./category.validation');
const { assetModelValidation } = require('./assetModel.validation');
const { assetValidation } = require('./asset.validation');
const {
  customFieldDefinitionValidation,
  customFieldCreateValidation,
  customFieldUpdateValidation,
} = require('./customField.validation');
const { reservationValidation } = require('./reservation.validation');
const { loanValidation, loanSignValidation } = require('./loan.validation');
const { userCreateValidation, userUpdateValidation } = require('./user.validation');
const { roleValidation } = require('./role.validation');
const { permissionValidation } = require('./permission.validation');
const { openingHoursValidation } = require('./openingHours.validation');
const { lendingLocationValidation } = require('./lendingLocation.validation');

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
  lendingLocationValidation,
};
