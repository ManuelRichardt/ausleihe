const { body } = require('express-validator');
const { createServices } = require('../services');

const services = createServices();

const roleValidation = [
  body('name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name ist erforderlich')
    .bail()
    .custom(async (value, { req }) => {
      const roles = await services.roleService.searchRoles({ name: value });
      if (roles.length && (!req.params || roles[0].id !== req.params.id)) {
        throw new Error('Rollenname ist bereits vergeben');
      }
      return true;
    }),
  body('scope')
    .isIn(['global', 'ausleihe', 'both'])
    .withMessage('Scope ist ungültig'),
];

module.exports = {
  roleValidation,
};
