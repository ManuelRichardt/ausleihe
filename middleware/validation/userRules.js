const { body } = require('express-validator');
const validator = require('validator');
const { createServices } = require('../../services');

const services = createServices();

const baseUserValidation = [
  body('username')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Benutzername ist erforderlich')
    .bail()
    .custom(async (value, { req }) => {
      const existing = await services.userService.searchUsers({ username: value });
      if (existing.length && (!req.params || existing[0].id !== req.params.id)) {
        throw new Error('Benutzername ist bereits vergeben');
      }
      return true;
    }),
  body('email')
    .isEmail()
    .withMessage('E-Mail ist ungültig')
    .bail()
    .custom(async (value, { req }) => {
      const existing = await services.userService.searchUsers({ email: value });
      if (existing.length && (!req.params || existing[0].id !== req.params.id)) {
        throw new Error('E-Mail ist bereits vergeben');
      }
      return true;
    }),
  body('firstName')
    .optional({ nullable: true })
    .isString()
    .withMessage('Vorname ist ungültig'),
  body('lastName')
    .optional({ nullable: true })
    .isString()
    .withMessage('Nachname ist ungültig'),
  body('isActive')
    .optional({ nullable: true })
    .isIn(['true', 'false'])
    .withMessage('Status ist ungültig'),
  body('roleIds')
    .optional({ nullable: true })
    .custom((value) => {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (!validator.isUUID(String(item))) {
            throw new Error('Rolle ist ungültig');
          }
        }
        return true;
      }
      if (typeof value === 'string') {
        if (!validator.isUUID(value)) {
          throw new Error('Rolle ist ungültig');
        }
        return true;
      }
      return false;
    })
    .withMessage('Rollen sind ungültig'),
];

const userCreateValidation = [
  ...baseUserValidation,
  body('password')
    .isString()
    .notEmpty()
    .withMessage('Passwort ist erforderlich')
    .isLength({ min: 8 })
    .withMessage('Passwort muss mindestens 8 Zeichen haben'),
];

const userUpdateValidation = [
  ...baseUserValidation,
  body('password')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ min: 8 })
    .withMessage('Passwort muss mindestens 8 Zeichen haben'),
];

module.exports = {
  userCreateValidation,
  userUpdateValidation,
};
