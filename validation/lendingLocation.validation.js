const { body } = require('express-validator');

const lendingLocationValidation = [
  body('name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name ist erforderlich'),
  body('contactEmail')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Kontakt E-Mail ist ungültig'),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('removeImage')
    .optional({ nullable: true })
    .isIn(['0', '1', 'true', 'false'])
    .withMessage('Bild-Option ist ungültig'),
  body('adminUserId')
    .isUUID()
    .withMessage('Administrator ist erforderlich'),
  body('isActive')
    .optional({ nullable: true })
    .isIn(['true', 'false'])
    .withMessage('Status ist ungültig'),
];

module.exports = {
  lendingLocationValidation,
};
