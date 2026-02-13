const { body } = require('express-validator');

const assetModelValidation = [
  body('manufacturerId')
    .isUUID()
    .withMessage('Hersteller ist erforderlich'),
  body('name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name ist erforderlich'),
  body('categoryId')
    .isUUID()
    .withMessage('Kategorie ist erforderlich'),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('technicalDescription')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('imageUrl')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('specs')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (typeof value === 'object') {
        return true;
      }
      try {
        JSON.parse(value);
        return true;
      } catch (err) {
        throw new Error('Specs müssen gültiges JSON sein');
      }
    }),
];

module.exports = {
  assetModelValidation,
};
