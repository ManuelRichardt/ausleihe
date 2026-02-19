const { body } = require('express-validator');

const loanValidation = [
  body('userId').optional({ nullable: true }).isUUID().withMessage('User ID ist ungültig'),
  body('lendingLocationId')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('Ausleihe ist ungültig'),
  body('status')
    .optional({ nullable: true })
    .isIn(['reserved', 'cancelled', 'handed_over', 'returned', 'overdue'])
    .withMessage('Status ist ungültig'),
  body('handedOverAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Übergabe-Datum ist ungültig'),
  body('returnedAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Rückgabe-Datum ist ungültig'),
];

const loanSignValidation = [
  body('signatureType')
    .isIn(['handover', 'return'])
    .withMessage('Signaturtyp ist erforderlich'),
  body('signedByName')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name ist erforderlich'),
  body('signatureBase64')
    .isString()
    .notEmpty()
    .withMessage('Signatur ist erforderlich'),
  body('signedAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Datum ist ungültig'),
];

module.exports = {
  loanValidation,
  loanSignValidation,
};
