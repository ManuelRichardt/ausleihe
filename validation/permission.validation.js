const { body } = require('express-validator');
const { createServices } = require('../services');

const services = createServices();

const permissionValidation = [
  body('key')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Key ist erforderlich')
    .bail()
    .custom(async (value, { req }) => {
      const existing = await services.permissionService.searchPermissions({ key: value });
      if (existing.length && (!req.params || existing[0].id !== req.params.id)) {
        throw new Error('Key ist bereits vergeben');
      }
      return true;
    }),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('scope')
    .optional({ nullable: true })
    .isIn(['global', 'ausleihe', 'both'])
    .withMessage('Scope ist ungültig'),
];

module.exports = {
  permissionValidation,
};
