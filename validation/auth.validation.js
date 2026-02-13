const { body } = require('express-validator');

const loginValidation = [
  body('username')
    .isString()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Benutzername ist erforderlich'),
  body('password')
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ min: 1 })
    .withMessage('Passwort ist erforderlich'),
];

module.exports = {
  loginValidation,
};
