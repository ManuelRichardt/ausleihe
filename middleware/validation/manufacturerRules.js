const { body } = require('express-validator');
const { createServices } = require('../../services');

const services = createServices();

const manufacturerValidation = [
  body('name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name ist erforderlich')
    .bail()
    .custom(async (value, { req }) => {
      const lendingLocationId = req.lendingLocationId || req.body.lendingLocationId;
      if (!lendingLocationId) {
        return true;
      }
      const existing = await services.manufacturerService.getAll({ lendingLocationId });
      const found = existing.find((m) => m.name.toLowerCase() === value.toLowerCase());
      if (found && (!req.params || found.id !== req.params.id)) {
        throw new Error('Name ist bereits vergeben');
      }
      return true;
    }),
  body('website')
    .optional({ nullable: true, checkFalsy: true })
    .isURL()
    .withMessage('Website muss eine gültige URL sein'),
];

module.exports = {
  manufacturerValidation,
};
