const { body } = require('express-validator');

const openingExceptionValidation = [
  body('date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Datum ist ungültig'),
  body('dateFrom')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Datum von ist ungültig'),
  body('dateTo')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Datum bis ist ungültig'),
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
  body('reason')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 200 })
    .withMessage('Grund ist ungültig'),
  body().custom((_, { req }) => {
    const from = req.body.dateFrom || req.body.date;
    const to = req.body.dateTo || from;
    if (!from) {
      throw new Error('Datum von ist erforderlich');
    }
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T00:00:00.000Z`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new Error('Datumsbereich ist ungültig');
    }
    if (toDate < fromDate) {
      throw new Error('Datum bis muss größer oder gleich Datum von sein');
    }
    return true;
  }),
];

module.exports = {
  openingExceptionValidation,
};
