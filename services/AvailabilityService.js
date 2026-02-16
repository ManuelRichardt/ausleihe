const { Op } = require('sequelize');
const { toDateOnly, getOpeningWindows } = require('../utils/openingHours');

class AvailabilityService {
  constructor(models) {
    this.models = models;
  }

  async getTrackingType(assetModelId) {
    const model = await this.models.AssetModel.findByPk(assetModelId);
    if (!model) {
      throw new Error('AssetModel not found');
    }
    return model.trackingType || 'serialized';
  }

  async countAvailableUnits(assetModelId, lendingLocationId = null) {
    const trackingType = await this.getTrackingType(assetModelId);
    if (trackingType === 'bulk') {
      const where = { assetModelId };
      if (lendingLocationId) {
        where.lendingLocationId = lendingLocationId;
      }
      const stocks = await this.models.InventoryStock.findAll({ where });
      return stocks.reduce((sum, row) => sum + (row.quantityAvailable || 0), 0);
    }
    if (trackingType === 'bundle') {
      const bundle = await this.models.BundleDefinition.findOne({
        where: { assetModelId },
        include: [{ model: this.models.BundleItem, as: 'items' }],
      });
      if (!bundle || !Array.isArray(bundle.items) || !bundle.items.length) {
        return 0;
      }
      let bundleCount = null;
      for (const component of bundle.items) {
        if (component.isOptional) {
          continue;
        }
        const requiredQty = Math.max(parseInt(component.quantity || '1', 10), 1);
        const units = await this.countAvailableUnits(component.componentAssetModelId, lendingLocationId);
        const possible = Math.floor(units / requiredQty);
        bundleCount = bundleCount === null ? possible : Math.min(bundleCount, possible);
      }
      return bundleCount === null ? 0 : Math.max(bundleCount, 0);
    }
    return this.models.Asset.count({
      where: { assetModelId, isActive: true },
    });
  }

  async countAvailableAssets(assetModelId) {
    return this.countAvailableUnits(assetModelId);
  }

  async countConflicts(assetModelId, start, end) {
    const trackingType = await this.getTrackingType(assetModelId);
    if (trackingType === 'bulk') {
      return 0;
    }
    if (trackingType === 'bundle') {
      return 0;
    }
    const { LoanItem, Loan, sequelize } = this.models;
    const startDateOnly = toDateOnly(start);
    const endDateOnly = toDateOnly(end);
    const rows = await LoanItem.findAll({
      where: { assetModelId },
      attributes: ['quantity'],
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
    return rows.reduce((sum, row) => sum + Math.max(parseInt(row.quantity || '1', 10), 1), 0);
  }

  async countConflictsByDate(assetModelId, dateOnly) {
    const trackingType = await this.getTrackingType(assetModelId);
    if (trackingType === 'bulk') {
      return 0;
    }
    if (trackingType === 'bundle') {
      return 0;
    }
    const { LoanItem, Loan, sequelize } = this.models;
    const rows = await LoanItem.findAll({
      where: { assetModelId },
      attributes: ['quantity'],
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
    return rows.reduce((sum, row) => sum + Math.max(parseInt(row.quantity || '1', 10), 1), 0);
  }

  async isModelAvailable(assetModelId, start, end) {
    const model = await this.models.AssetModel.findByPk(assetModelId);
    if (!model) {
      return false;
    }
    if ((model.trackingType || 'serialized') === 'bundle') {
      const bundleDefinition = await this.models.BundleDefinition.findOne({
        where: { assetModelId: model.id },
        include: [{ model: this.models.BundleItem, as: 'items' }],
      });
      if (!bundleDefinition) {
        return false;
      }
      for (const component of bundleDefinition.items || []) {
        if (component.isOptional) {
          continue;
        }
        try {
          await this.assertAvailability(component.componentAssetModelId, start, end, component.quantity);
        } catch (err) {
          return false;
        }
      }
      return true;
    }
    const total = await this.countAvailableUnits(assetModelId, model.lendingLocationId);
    if (!total) {
      return false;
    }
    const conflicts = await this.countConflicts(assetModelId, start, end);
    return conflicts < total;
  }

  async assertAvailability(assetModelId, start, end, quantity = 1) {
    const required = Math.max(parseInt(quantity || '1', 10), 1);
    const model = await this.models.AssetModel.findByPk(assetModelId);
    if (!model) {
      throw new Error('AssetModel not found');
    }
    const trackingType = model.trackingType || 'serialized';
    if (trackingType === 'bundle') {
      const bundleDefinition = await this.models.BundleDefinition.findOne({
        where: { assetModelId: model.id },
        include: [{ model: this.models.BundleItem, as: 'items' }],
      });
      if (!bundleDefinition) {
        throw new Error('Kein Bundle definiert');
      }
      for (const component of bundleDefinition.items || []) {
        if (component.isOptional) continue;
        await this.assertAvailability(component.componentAssetModelId, start, end, component.quantity * required);
      }
      return true;
    }
    const total = await this.countAvailableUnits(assetModelId, model.lendingLocationId);
    if (!total) {
      throw new Error('Keine Assets fuer dieses Modell verfuegbar');
    }
    const conflicts = trackingType === 'bulk' ? 0 : await this.countConflicts(assetModelId, start, end);
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
        const total = await this.countAvailableUnits(assetModelId, model.lendingLocationId);
        if (total > 0) {
          const conflicts = (model.trackingType || 'serialized') === 'bulk'
            ? 0
            : await this.countConflictsByDate(assetModelId, toDateOnly(dayStart));
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

    const trackingType = model.trackingType || 'serialized';
    const bundleDefinition = trackingType === 'bundle'
      ? await this.models.BundleDefinition.findOne({
        where: { assetModelId: model.id },
        include: [{ model: this.models.BundleItem, as: 'items', include: [{ model: this.models.AssetModel, as: 'componentModel' }] }],
      })
      : null;
    const total = trackingType === 'bundle'
      ? await this.countAvailableUnits(assetModelId, model.lendingLocationId)
      : await this.countAvailableUnits(assetModelId, model.lendingLocationId);
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
      if (trackingType === 'bundle') {
        if (!bundleDefinition || !Array.isArray(bundleDefinition.items) || !bundleDefinition.items.length) {
          availableCount = 0;
        } else {
          let possibleBundles = null;
          for (const component of bundleDefinition.items) {
            if (component.isOptional) {
              continue;
            }
            const requiredQty = Math.max(parseInt(component.quantity || '1', 10), 1);
            const componentModel = component.componentModel;
            if (!componentModel) {
              possibleBundles = 0;
              break;
            }
            let totalUnits = 0;
            let availableUnits = 0;
            if ((componentModel.trackingType || 'serialized') === 'bulk') {
              const stock = await this.models.InventoryStock.findOne({
                where: {
                  assetModelId: component.componentAssetModelId,
                  lendingLocationId: model.lendingLocationId,
                },
              });
              totalUnits = stock ? stock.quantityTotal : 0;
              availableUnits = stock ? stock.quantityAvailable : 0;
            } else {
              totalUnits = await this.models.Asset.count({
                where: { assetModelId: component.componentAssetModelId, isActive: true },
              });
              const componentConflicts = await this.countConflictsByDate(
                component.componentAssetModelId,
                toDateOnly(dayStart)
              );
              availableUnits = Math.max(totalUnits - componentConflicts, 0);
            }
            const possibleForComponent = Math.floor(availableUnits / requiredQty);
            possibleBundles = possibleBundles === null
              ? possibleForComponent
              : Math.min(possibleBundles, possibleForComponent);
          }
          availableCount = possibleBundles === null ? 0 : Math.max(possibleBundles, 0);
        }
      } else if (total > 0) {
        const conflicts = trackingType === 'bulk'
          ? 0
          : await this.countConflictsByDate(assetModelId, toDateOnly(dayStart));
        availableCount = Math.max(total - conflicts, 0);
      }

      results.push({
        date: toDateOnly(dayStart),
        isOpen,
        hasPickup,
        hasReturn,
        openTime,
        closeTime,
        totalCount: trackingType === 'bundle' ? total : total,
        availableCount,
      });
    }

    return results;
  }
}

module.exports = AvailabilityService;
