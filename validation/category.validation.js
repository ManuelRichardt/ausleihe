const { body } = require('express-validator');

const categoryValidation = [
  body('name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name ist erforderlich'),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('removeImage')
    .optional({ nullable: true })
    .isIn(['0', '1', 'true', 'false'])
    .withMessage('Bild-Option ist ungültig'),
  body('isActive')
    .optional({ nullable: true })
    .isIn(['true', 'false'])
    .withMessage('Status ist ungültig'),
];

module.exports = {
  categoryValidation,
};
