const { Op } = require('sequelize');
const { toDateOnly, getOpeningWindows } = require('../utils/openingHours');

class AvailabilityService {
  constructor(models) {
    this.models = models;
  }

  async countAvailableAssets(assetModelId) {
    return this.models.Asset.count({
      where: { assetModelId, isActive: true },
    });
  }

  async countConflicts(assetModelId, start, end) {
    const { LoanItem, Loan, sequelize } = this.models;
    const startDateOnly = toDateOnly(start);
    const endDateOnly = toDateOnly(end);
    return LoanItem.count({
      where: { assetModelId },
      include: [
        {
          model: Loan,
          as: 'loan',
          where: {
            status: { [Op.in]: ['reserved', 'handed_over', 'overdue'] },
            [Op.and]: [
              sequelize.where(sequelize.fn('DATE', sequelize.col('reserved_from')), {
                [Op.lt]: endDateOnly,
              }),
              sequelize.where(sequelize.fn('DATE', sequelize.col('reserved_until')), {
                [Op.gt]: startDateOnly,
              }),
            ],
          },
        },
      ],
    });
  }

  async countConflictsByDate(assetModelId, dateOnly) {
    const { LoanItem, Loan, sequelize } = this.models;
    return LoanItem.count({
      where: { assetModelId },
      include: [
        {
          model: Loan,
          as: 'loan',
          where: {
            status: { [Op.in]: ['reserved', 'handed_over', 'overdue'] },
            [Op.and]: [
              sequelize.where(sequelize.fn('DATE', sequelize.col('reserved_from')), {
                [Op.lte]: dateOnly,
              }),
              sequelize.where(sequelize.fn('DATE', sequelize.col('reserved_until')), {
                [Op.gt]: dateOnly,
              }),
            ],
          },
        },
      ],
    });
  }

  async isModelAvailable(assetModelId, start, end) {
    const total = await this.countAvailableAssets(assetModelId);
    if (!total) {
      return false;
    }
    const conflicts = await this.countConflicts(assetModelId, start, end);
    return conflicts < total;
  }

  async assertAvailability(assetModelId, start, end, quantity = 1) {
    const required = Math.max(parseInt(quantity || '1', 10), 1);
    const total = await this.countAvailableAssets(assetModelId);
    if (!total) {
      throw new Error('Keine Assets fuer dieses Modell verfuegbar');
    }
    const conflicts = await this.countConflicts(assetModelId, start, end);
    if (total - conflicts < required) {
      throw new Error('Im gewaehlten Zeitraum sind keine Assets verfuegbar');
    }
    return true;
  }

  async getModelAvailabilityCalendar(assetModelId, days = 14) {
    const model = await this.models.AssetModel.findByPk(assetModelId);
    if (!model) {
      throw new Error('AssetModel not found');
    }

    const results = [];
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < days; i += 1) {
      const dayStart = new Date(startDate);
      dayStart.setDate(startDate.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const pickupWindows = await getOpeningWindows(this.models, model.lendingLocationId, dayStart, 'pickup');
      const returnWindows = await getOpeningWindows(this.models, model.lendingLocationId, dayStart, 'return');
      const hasPickup = Boolean(pickupWindows && pickupWindows.length);
      const hasReturn = Boolean(returnWindows && returnWindows.length);
      let available = false;
      if (hasPickup || hasReturn) {
        const total = await this.countAvailableAssets(assetModelId);
        if (total > 0) {
          const conflicts = await this.countConflictsByDate(assetModelId, toDateOnly(dayStart));
          available = conflicts < total;
        }
      }

      results.push({
        date: toDateOnly(dayStart),
        isOpen: Boolean(hasPickup || hasReturn),
        hasPickup,
        hasReturn,
        available,
      });
    }

    return results;
  }

  async getDailyAvailability(assetModelId, startDate = new Date(), days = 60) {
    const model = await this.models.AssetModel.findByPk(assetModelId);
    if (!model) {
      throw new Error('AssetModel not found');
    }

    const total = await this.countAvailableAssets(assetModelId);
    const results = [];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    for (let i = 0; i < days; i += 1) {
      const dayStart = new Date(start);
      dayStart.setDate(start.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const pickupWindows = await getOpeningWindows(this.models, model.lendingLocationId, dayStart, 'pickup');
      const returnWindows = await getOpeningWindows(this.models, model.lendingLocationId, dayStart, 'return');
      const hasPickup = Boolean(pickupWindows && pickupWindows.length);
      const hasReturn = Boolean(returnWindows && returnWindows.length);
      const isOpen = Boolean(hasPickup || hasReturn);
      const openTime = pickupWindows && pickupWindows.length
        ? pickupWindows.map((w) => w.openTime).sort()[0]
        : null;
      const closeTime = returnWindows && returnWindows.length
        ? returnWindows.map((w) => w.closeTime).sort().slice(-1)[0]
        : null;

      let availableCount = 0;
      if (total > 0) {
        const conflicts = await this.countConflictsByDate(assetModelId, toDateOnly(dayStart));
        availableCount = Math.max(total - conflicts, 0);
      }

      results.push({
        date: toDateOnly(dayStart),
        isOpen,
        hasPickup,
        hasReturn,
        openTime,
        closeTime,
        totalCount: total,
        availableCount,
      });
    }

    return results;
  }
}

module.exports = AvailabilityService;
