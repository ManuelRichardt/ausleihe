const { body } = require('express-validator');
const { createServices } = require('../services');

const services = createServices();

async function validateCustomFields(value, { req }) {
  const assetModelId = req.body.assetModelId || req.body.assetModel?.id;
  const lendingLocationId = req.body.lendingLocationId || req.body.lendingLocation?.id;
  const fields = req.body.customFields || {};

  if (!assetModelId && !lendingLocationId) {
    return true;
  }

  const definitions = [];
  if (assetModelId) {
    const defs = await services.customFieldDefinitionService.getByAssetModel(assetModelId);
    definitions.push(...defs);
  }
  if (lendingLocationId) {
    const defs = await services.customFieldDefinitionService.getByLendingLocation(lendingLocationId);
    definitions.push(...defs);
  }

  for (const def of definitions) {
    const fieldValue = fields[def.id] ?? fields[def.key];
    if (def.required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
      throw new Error(`Feld "${def.label}" ist erforderlich`);
    }
    if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
      continue;
    }
    switch (def.type) {
      case 'string':
      case 'text':
        if (typeof fieldValue !== 'string') {
          throw new Error(`Feld "${def.label}" muss Text sein`);
        }
        break;
      case 'number':
        if (Number.isNaN(Number(fieldValue))) {
          throw new Error(`Feld "${def.label}" muss eine Zahl sein`);
        }
        break;
      case 'boolean':
        if (!(fieldValue === true || fieldValue === false || fieldValue === 'true' || fieldValue === 'false')) {
          throw new Error(`Feld "${def.label}" muss Ja/Nein sein`);
        }
        break;
      case 'date':
        if (Number.isNaN(new Date(fieldValue).getTime())) {
          throw new Error(`Feld "${def.label}" muss ein Datum sein`);
        }
        break;
      case 'enum':
      case 'select':
        if (!Array.isArray(def.enumValues) || !def.enumValues.includes(fieldValue)) {
          throw new Error(`Feld "${def.label}" hat einen ungültigen Wert`);
        }
        break;
      default:
        break;
    }
  }

  return true;
}

const assetValidation = [
  body('assetModelId')
    .isUUID()
    .withMessage('Modell ist erforderlich'),
  body('lendingLocationId')
    .isUUID()
    .withMessage('Ausleihe ist erforderlich'),
  body('storageLocationId')
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage('Lagerort ist ungültig'),
  body('inventoryNumber')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim(),
  body('serialNumber')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('status')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['active', 'inactive', 'maintenance'])
    .withMessage('Status ist ungültig'),
  body('condition')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('customFields')
    .optional({ nullable: true })
    .custom(validateCustomFields),
];

module.exports = {
  assetValidation,
};
