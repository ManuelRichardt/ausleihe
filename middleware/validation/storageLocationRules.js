const { body } = require('express-validator');

const storageLocationValidation = [
  body('name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name ist erforderlich')
    .isLength({ max: 150 })
    .withMessage('Name darf maximal 150 Zeichen lang sein'),
  body('description')
    .optional({ nullable: true })
    .isString()
    .withMessage('Beschreibung ist ungültig'),
  body('isActive')
    .optional({ nullable: true })
    .isIn(['true', 'false'])
    .withMessage('Status ist ungültig'),
];

module.exports = {
  storageLocationValidation,
};
