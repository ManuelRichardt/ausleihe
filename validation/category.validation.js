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
  body('isActive')
    .optional({ nullable: true })
    .isIn(['true', 'false'])
    .withMessage('Status ist ungültig'),
];

module.exports = {
  categoryValidation,
};
