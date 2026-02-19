const { body } = require('express-validator');
const { Op } = require('sequelize');
const models = require('../../models');
const { assertOpenForRange } = require('../../utils/openingHours');

function resolveAssetModelId(req) {
  if (req.body.items && Array.isArray(req.body.items) && req.body.items[0]) {
    return req.body.items[0].assetModelId;
  }
  if (req.body.items && typeof req.body.items === 'object') {
    const first = Object.values(req.body.items)[0];
    return first ? first.assetModelId : null;
  }
  return null;
}

async function checkAvailability(value, { req }) {
  const assetModelId = value;
  const rawQuantity =
    req.body.items && Array.isArray(req.body.items) && req.body.items[0]
      ? req.body.items[0].quantity
      : req.body.items && typeof req.body.items === 'object'
      ? (Object.values(req.body.items)[0] || {}).quantity
      : 1;
  const quantity = Math.max(parseInt(rawQuantity || '1', 10), 1);
  const reservedFrom = new Date(req.body.reservedFrom);
  const reservedUntil = new Date(req.body.reservedUntil);

  if (!assetModelId || Number.isNaN(reservedFrom.getTime()) || Number.isNaN(reservedUntil.getTime())) {
    return true;
  }

  const model = await models.AssetModel.findByPk(assetModelId);
  if (!model) {
    throw new Error('Modell nicht gefunden');
  }

  await assertOpenForRange(models, model.lendingLocationId, reservedFrom, reservedUntil);

  const totalAssets = await models.Asset.count({
    where: { assetModelId, isActive: true },
  });
  if (!totalAssets) {
    throw new Error('Keine Assets fuer dieses Modell verfuegbar');
  }

  const startDateOnly = models.sequelize.fn('DATE', models.sequelize.col('loan.reserved_from'));
  const endDateOnly = models.sequelize.fn('DATE', models.sequelize.col('loan.reserved_until'));
  const startValue = req.body.reservedFrom ? String(req.body.reservedFrom).slice(0, 10) : '';
  const endValue = req.body.reservedUntil ? String(req.body.reservedUntil).slice(0, 10) : '';

  const conflicts = await models.LoanItem.count({
    where: { assetModelId },
    include: [
      {
        model: models.Loan,
        as: 'loan',
        where: {
          status: { [Op.in]: ['reserved', 'handed_over', 'overdue'] },
          [Op.and]: [
            models.sequelize.where(startDateOnly, { [Op.lt]: endValue }),
            models.sequelize.where(endDateOnly, { [Op.gt]: startValue }),
          ],
        },
      },
    ],
  });

  if (conflicts + quantity > totalAssets) {
    throw new Error('Im gewaehlten Zeitraum sind keine Assets verfuegbar');
  }

  return true;
}

const reservationValidation = [
  body('items')
    .custom((value) => {
      if (Array.isArray(value) && value.length) {
        return true;
      }
      if (value && typeof value === 'object' && Object.keys(value).length) {
        return true;
      }
      throw new Error('Mindestens ein Modell ist erforderlich');
    }),
  body('items.*.assetModelId')
    .isUUID()
    .withMessage('Modell ist erforderlich')
    .bail()
    .custom(checkAvailability),
  body('reservedFrom')
    .isISO8601()
    .withMessage('Startdatum ist erforderlich'),
  body('reservedUntil')
    .isISO8601()
    .withMessage('Enddatum ist erforderlich')
    .bail()
    .custom((value, { req }) => {
      const from = new Date(req.body.reservedFrom);
      const until = new Date(value);
      if (until <= from) {
        throw new Error('Enddatum muss nach dem Startdatum liegen');
      }
      return true;
    })
    .bail()
    .custom(async (value, { req }) => {
      const assetModelId = resolveAssetModelId(req);
      if (!assetModelId) {
        return true;
      }
      const model = await models.AssetModel.findByPk(assetModelId);
      if (!model) {
        return true;
      }
      await assertOpenForRange(models, model.lendingLocationId, req.body.reservedFrom, value);
      return true;
    }),
];

module.exports = {
  reservationValidation,
};
