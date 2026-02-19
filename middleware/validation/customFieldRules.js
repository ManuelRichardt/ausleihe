const { body } = require('express-validator');
const { createServices } = require('../../services');

const services = createServices();

function parseOptions(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch (err) {
      return null;
    }
  }
  return null;
}

const baseDefinitionValidation = [
  body('key')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Key ist erforderlich')
    .bail()
    .custom(async (value, { req }) => {
      if (req.body.scope === 'asset_model') {
        const existing = await services.customFieldDefinitionService.getByAssetModel(
          req.body.assetModelId || ''
        );
        if (existing.find((def) => def.key === value && def.id !== req.params.id)) {
          throw new Error('Key ist bereits vergeben');
        }
        return true;
      }
      const existing = await services.customFieldDefinitionService.getByLendingLocation(
        req.body.lendingLocationId || ''
      );
      if (existing.find((def) => def.key === value && def.id !== req.params.id)) {
        throw new Error('Key ist bereits vergeben');
      }
      return true;
    }),
  body('label')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Label ist erforderlich'),
  body('type')
    .isIn(['string', 'number', 'boolean', 'date', 'select', 'text', 'enum'])
    .withMessage('Typ ist ungültig'),
  body('required')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === undefined || value === null || value === '') {
        return true;
      }
      const normalized = String(value).toLowerCase();
      if (['true', 'false', '1', '0', 'on', 'off'].includes(normalized)) {
        return true;
      }
      throw new Error('Required muss boolean sein');
    }),
  body('enumValues')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      if (req.body.type === 'select' || req.body.type === 'enum') {
        const options = parseOptions(value);
        if (!options || options.length === 0) {
          throw new Error('Optionen sind erforderlich');
        }
      }
      return true;
    }),
];

module.exports = {
  customFieldDefinitionValidation: baseDefinitionValidation,
  customFieldCreateValidation: baseDefinitionValidation,
  customFieldUpdateValidation: [
    body('label')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Label ist erforderlich'),
    body('type')
      .isIn(['string', 'number', 'boolean', 'date', 'select', 'text', 'enum'])
      .withMessage('Typ ist ungültig'),
  body('required')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === undefined || value === null || value === '') {
        return true;
      }
      const normalized = String(value).toLowerCase();
      if (['true', 'false', '1', '0', 'on', 'off'].includes(normalized)) {
        return true;
      }
      throw new Error('Required muss boolean sein');
    }),
    body('enumValues')
      .optional({ nullable: true })
      .custom((value, { req }) => {
        if (req.body.type === 'select' || req.body.type === 'enum') {
          const options = parseOptions(value);
          if (!options || options.length === 0) {
            throw new Error('Optionen sind erforderlich');
          }
        }
        return true;
      }),
  ],
};
