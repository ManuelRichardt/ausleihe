const { body } = require('express-validator');
const { createServices } = require('../services');

const services = createServices();

function parseBoolean(value) {
  if (value === true || value === false) {
    return true;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', '0', 'true', 'false', 'yes', 'no', 'ja', 'nein', 'on', 'off'].includes(normalized);
  }
  return false;
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

async function validateModelCustomFields(value, { req }) {
  const fields = req.body && req.body.customFields && typeof req.body.customFields === 'object'
    ? req.body.customFields
    : {};
  const definitions = await services.customFieldDefinitionService.getAll({
    scope: 'global',
    isActive: true,
  });

  for (const definition of definitions) {
    const hasIdKey = Object.prototype.hasOwnProperty.call(fields, definition.id);
    const hasFieldKey = Object.prototype.hasOwnProperty.call(fields, definition.key);
    const provided = hasIdKey ? fields[definition.id] : (hasFieldKey ? fields[definition.key] : undefined);
    const fallback = definition.defaultValue !== undefined && definition.defaultValue !== null
      ? definition.defaultValue
      : undefined;
    const effective = provided === undefined || provided === null || provided === '' ? fallback : provided;

    if ((effective === undefined || effective === null || effective === '') && definition.required) {
      throw new Error(`Feld "${definition.label}" ist erforderlich`);
    }
    if (effective === undefined || effective === null || effective === '') {
      continue;
    }

    switch (definition.type) {
      case 'number':
        if (Number.isNaN(Number(effective))) {
          throw new Error(`Feld "${definition.label}" muss eine Zahl sein`);
        }
        break;
      case 'boolean':
        if (!parseBoolean(effective)) {
          throw new Error(`Feld "${definition.label}" muss Ja/Nein sein`);
        }
        break;
      case 'date':
        if (!isValidIsoDate(effective)) {
          throw new Error(`Feld "${definition.label}" muss ein gültiges Datum sein`);
        }
        break;
      case 'enum':
        if (!Array.isArray(definition.enumValues) || !definition.enumValues.includes(String(effective))) {
          throw new Error(`Feld "${definition.label}" hat einen ungültigen Wert`);
        }
        break;
      case 'string':
      case 'text':
      default:
        break;
    }
  }

  return true;
}

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
  body('customFields').custom(validateModelCustomFields),
];

module.exports = {
  assetModelValidation,
};
