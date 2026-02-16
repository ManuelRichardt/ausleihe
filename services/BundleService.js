const { Op } = require('sequelize');

class BundleService {
  constructor(models, availabilityService, inventoryStockService) {
    this.models = models;
    this.availabilityService = availabilityService;
    this.inventoryStockService = inventoryStockService;
  }

  async getBundleDefinition(bundleDefinitionId, options = {}) {
    const bundle = await this.models.BundleDefinition.findByPk(bundleDefinitionId, {
      include: [
        {
          model: this.models.BundleItem,
          as: 'items',
          include: [{ model: this.models.AssetModel, as: 'componentModel' }],
        },
        {
          model: this.models.AssetModel,
          as: 'bundleModel',
          include: [
            { model: this.models.Manufacturer, as: 'manufacturer' },
            { model: this.models.AssetCategory, as: 'category' },
            { model: this.models.LendingLocation, as: 'lendingLocation' },
          ],
        },
      ],
      transaction: options.transaction,
      paranoid: options.includeDeleted ? false : true,
    });
    if (!bundle) {
      throw new Error('BundleDefinition not found');
    }
    return bundle;
  }

  async getByAssetModel(assetModelId, lendingLocationId = null, options = {}) {
    const where = { assetModelId };
    if (lendingLocationId) {
      where[Op.or] = [{ lendingLocationId }, { lendingLocationId: null }];
    }
    const bundle = await this.models.BundleDefinition.findOne({
      where,
      include: [
        {
          model: this.models.BundleItem,
          as: 'items',
          include: [{ model: this.models.AssetModel, as: 'componentModel' }],
        },
        {
          model: this.models.AssetModel,
          as: 'bundleModel',
          include: [
            { model: this.models.Manufacturer, as: 'manufacturer' },
            { model: this.models.AssetCategory, as: 'category' },
            { model: this.models.LendingLocation, as: 'lendingLocation' },
          ],
        },
      ],
      order: [[{ model: this.models.BundleItem, as: 'items' }, 'createdAt', 'ASC']],
      transaction: options.transaction,
      paranoid: options.includeDeleted ? false : true,
    });
    return bundle;
  }

  async listBundles(lendingLocationId = null, options = {}) {
    const where = {};
    if (lendingLocationId) {
      where[Op.or] = [{ lendingLocationId }, { lendingLocationId: null }];
    }
    return this.models.BundleDefinition.findAll({
      where,
      include: [
        {
          model: this.models.BundleItem,
          as: 'items',
          include: [{ model: this.models.AssetModel, as: 'componentModel' }],
        },
        { model: this.models.AssetModel, as: 'bundleModel' },
      ],
      order: [['name', 'ASC']],
      ...options,
    });
  }

  async computeBundleAvailability(bundleDefinitionId, lendingLocationId, range = {}) {
    const bundle = await this.getBundleDefinition(bundleDefinitionId);
    const start = range.reservedFrom || new Date();
    const end = range.reservedUntil || new Date(Date.now() + 86400000);
    const checks = [];
    let available = true;
    for (const item of bundle.items || []) {
      const componentModel = item.componentModel;
      if (!componentModel) {
        continue;
      }
      const requiredQty = Math.max(parseInt(item.quantity, 10) || 1, 1);
      let componentAvailable = false;
      let availableCount = 0;
      if (componentModel.trackingType === 'bulk') {
        const stock = await this.inventoryStockService.getStock(componentModel.id, lendingLocationId);
        availableCount = stock ? stock.quantityAvailable : 0;
        componentAvailable = availableCount >= requiredQty;
      } else {
        try {
          await this.availabilityService.assertAvailability(componentModel.id, start, end, requiredQty);
          const total = await this.availabilityService.countAvailableUnits(componentModel.id, lendingLocationId);
          const conflicts = await this.availabilityService.countConflicts(componentModel.id, start, end);
          availableCount = Math.max(total - conflicts, 0);
          componentAvailable = true;
        } catch (err) {
          componentAvailable = false;
          const total = await this.availabilityService.countAvailableUnits(componentModel.id, lendingLocationId);
          const conflicts = await this.availabilityService.countConflicts(componentModel.id, start, end);
          availableCount = Math.max(total - conflicts, 0);
        }
      }
      if (!item.isOptional && !componentAvailable) {
        available = false;
      }
      checks.push({
        bundleItemId: item.id,
        componentAssetModelId: componentModel.id,
        componentName: componentModel.name,
        trackingType: componentModel.trackingType || 'serialized',
        requiredQuantity: requiredQty,
        availableQuantity: availableCount,
        isOptional: Boolean(item.isOptional),
        available: componentAvailable,
      });
    }
    return { available, components: checks, bundle };
  }

  async reserveBundleComponents(params, options = {}) {
    const {
      loanId,
      bundleDefinitionId,
      lendingLocationId,
      reservedFrom,
      reservedUntil,
      status = 'reserved',
    } = params;
    const transaction = options.transaction;
    const { LoanItem } = this.models;
    const availability = await this.computeBundleAvailability(bundleDefinitionId, lendingLocationId, {
      reservedFrom,
      reservedUntil,
    });
    if (!availability.available) {
      const err = new Error('Bundle ist im gewählten Zeitraum nicht vollständig verfügbar');
      err.status = 422;
      throw err;
    }

    const bundleDef = availability.bundle;
    const root = await LoanItem.create(
      {
        loanId,
        assetModelId: bundleDef.assetModelId,
        assetId: null,
        quantity: 1,
        itemType: 'bundle_root',
        bundleDefinitionId,
        parentLoanItemId: null,
        status,
      },
      { transaction }
    );

    for (const component of availability.components) {
      if (!component.isOptional && !component.available) {
        const err = new Error(`Komponente nicht verfügbar: ${component.componentName}`);
        err.status = 422;
        throw err;
      }
      if (component.isOptional && !component.available) {
        continue;
      }
      if (component.trackingType === 'bulk') {
        await this.inventoryStockService.decreaseAvailable(
          component.componentAssetModelId,
          lendingLocationId,
          component.requiredQuantity,
          { transaction }
        );
      }
      await LoanItem.create(
        {
          loanId,
          assetId: null,
          assetModelId: component.componentAssetModelId,
          quantity: component.requiredQuantity,
          itemType: 'bundle_component',
          bundleDefinitionId,
          parentLoanItemId: root.id,
          status,
        },
        { transaction }
      );
    }

    return root;
  }

  async createBundleDefinition(data, options = {}) {
    const tx = options.transaction;
    const model = await this.models.AssetModel.findByPk(data.assetModelId, { transaction: tx });
    if (!model) throw new Error('AssetModel not found');
    if ((model.trackingType || 'serialized') !== 'bundle') {
      throw new Error('AssetModel trackingType must be bundle');
    }
    if (data.lendingLocationId && model.lendingLocationId !== data.lendingLocationId) {
      throw new Error('Bundle location mismatch');
    }
    return this.models.BundleDefinition.create(
      {
        assetModelId: data.assetModelId,
        lendingLocationId: data.lendingLocationId || null,
        name: data.name || model.name,
        description: data.description || null,
      },
      { transaction: tx }
    );
  }

  async updateBundleDefinition(id, updates, options = {}) {
    const tx = options.transaction;
    const bundle = await this.models.BundleDefinition.findByPk(id, { transaction: tx });
    if (!bundle) throw new Error('BundleDefinition not found');
    await bundle.update(
      {
        name: updates.name !== undefined ? updates.name : bundle.name,
        description: updates.description !== undefined ? updates.description : bundle.description,
      },
      { transaction: tx }
    );
    return bundle;
  }

  async deleteBundleDefinition(id, options = {}) {
    const tx = options.transaction;
    const bundle = await this.models.BundleDefinition.findByPk(id, { transaction: tx });
    if (!bundle) throw new Error('BundleDefinition not found');
    await this.models.BundleItem.destroy({ where: { bundleDefinitionId: id }, transaction: tx });
    await bundle.destroy({ transaction: tx });
    return true;
  }

  async addBundleItem(bundleDefinitionId, data, options = {}) {
    const tx = options.transaction;
    const bundle = await this.models.BundleDefinition.findByPk(bundleDefinitionId, { transaction: tx });
    if (!bundle) throw new Error('BundleDefinition not found');
    const component = await this.models.AssetModel.findByPk(data.componentAssetModelId, { transaction: tx });
    if (!component) throw new Error('Component model not found');
    if (bundle.lendingLocationId && component.lendingLocationId !== bundle.lendingLocationId) {
      throw new Error('Komponenten-Modell gehört zu einer anderen Ausleihe');
    }
    return this.models.BundleItem.create(
      {
        bundleDefinitionId,
        componentAssetModelId: data.componentAssetModelId,
        quantity: Math.max(parseInt(data.quantity || '1', 10), 1),
        isOptional: data.isOptional === true || data.isOptional === 'true' || data.isOptional === '1',
      },
      { transaction: tx }
    );
  }

  async removeBundleItem(bundleDefinitionId, bundleItemId, options = {}) {
    const tx = options.transaction;
    const item = await this.models.BundleItem.findOne({
      where: { id: bundleItemId, bundleDefinitionId },
      transaction: tx,
    });
    if (!item) throw new Error('BundleItem not found');
    await item.destroy({ transaction: tx });
    return true;
  }

  async replaceBundleItems(bundleDefinitionId, items = [], options = {}) {
    const tx = options.transaction;
    await this.models.BundleItem.destroy({ where: { bundleDefinitionId }, transaction: tx });
    for (const item of items) {
      await this.addBundleItem(bundleDefinitionId, item, { transaction: tx });
    }
    return this.getBundleDefinition(bundleDefinitionId, { transaction: tx });
  }
}

module.exports = BundleService;
