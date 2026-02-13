const { body } = require('express-validator');

const openingHoursValidation = [
  body('dayOfWeek')
    .isIn(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
    .withMessage('Wochentag ist ungültig'),
  body('openTime')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('Öffnungszeit ist ungültig'),
  body('closeTime')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('Schließzeit ist ungültig'),
  body('pickupOpenTime')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('Abholzeit ist ungültig'),
  body('pickupCloseTime')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('Abholzeit ist ungültig'),
  body('returnOpenTime')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('Rückgabezeit ist ungültig'),
  body('returnCloseTime')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('Rückgabezeit ist ungültig'),
  body('isClosed')
    .optional({ nullable: true })
    .isIn(['true', 'false'])
    .withMessage('Status ist ungültig'),
  body('validFrom')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('validFrom ist ungültig'),
  body('validTo')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('validTo ist ungültig'),
  body('exceptionType')
    .optional({ nullable: true })
    .isString(),
];

module.exports = {
  openingHoursValidation,
};
