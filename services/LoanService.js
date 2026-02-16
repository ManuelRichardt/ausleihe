const { buildListOptions } = require('./_serviceUtils');
const { assertOpenForRange, assertOpenAt } = require('../utils/openingHours');
const { Op } = require('sequelize');

class LoanService {
  constructor(models, availabilityService, inventoryStockService, bundleService) {
    this.models = models;
    if (availabilityService) {
      this.availabilityService = availabilityService;
    } else {
      const AvailabilityService = require('./AvailabilityService');
      this.availabilityService = new AvailabilityService(models);
    }
    if (inventoryStockService) {
      this.inventoryStockService = inventoryStockService;
    } else {
      const InventoryStockService = require('./InventoryStockService');
      this.inventoryStockService = new InventoryStockService(models);
    }
    if (bundleService) {
      this.bundleService = bundleService;
    } else {
      const BundleService = require('./BundleService');
      this.bundleService = new BundleService(models, this.availabilityService, this.inventoryStockService);
    }
  }

  async createReservation(data) {
    const {
      Loan,
      LoanItem,
      LoanEvent,
      User,
      LendingLocation,
      Asset,
      AssetModel,
      BundleDefinition,
      sequelize,
    } = this.models;
    return sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(data.userId, { transaction });
      if (!user) {
        throw new Error('User not found');
      }
      const location = await LendingLocation.findByPk(data.lendingLocationId, { transaction });
      if (!location) {
        throw new Error('LendingLocation not found');
      }
      if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('At least one item is required');
      }

      await assertOpenForRange(this.models, data.lendingLocationId, data.reservedFrom, data.reservedUntil);

      const loan = await Loan.create(
        {
          userId: data.userId,
          lendingLocationId: data.lendingLocationId,
          status: 'reserved',
          reservedFrom: data.reservedFrom,
          reservedUntil: data.reservedUntil,
          notes: data.notes || null,
        },
        { transaction }
      );

      for (const item of data.items) {
        const kind = String(item.kind || '').trim().toLowerCase();
        if (kind === 'bundle' || item.bundleDefinitionId) {
          const bundleDefinition = await BundleDefinition.findByPk(item.bundleDefinitionId, { transaction });
          if (!bundleDefinition) {
            throw new Error('BundleDefinition not found');
          }
          const bundleLocationId = bundleDefinition.lendingLocationId || data.lendingLocationId;
          if (bundleLocationId !== data.lendingLocationId) {
            throw new Error('BundleDefinition does not belong to lending location');
          }
          await this.bundleService.reserveBundleComponents(
            {
              loanId: loan.id,
              bundleDefinitionId: bundleDefinition.id,
              lendingLocationId: data.lendingLocationId,
              reservedFrom: data.reservedFrom,
              reservedUntil: data.reservedUntil,
              status: 'reserved',
            },
            { transaction }
          );
          continue;
        }

        let assetId = item.assetId || null;
        let assetModelId = item.assetModelId || null;
        let quantity = Math.max(parseInt(item.quantity || '1', 10), 1);

        if (assetId) {
          const asset = await Asset.findByPk(assetId, { transaction });
          if (!asset) {
            throw new Error('Asset not found');
          }
          if (asset.lendingLocationId !== data.lendingLocationId) {
            throw new Error('Asset does not belong to lending location');
          }
          assetModelId = asset.assetModelId;
        }

        if (!assetModelId) {
          throw new Error('AssetModel is required');
        }

        const model = await AssetModel.findByPk(assetModelId, { transaction });
        if (!model) {
          throw new Error('AssetModel not found');
        }
        if (model.lendingLocationId !== data.lendingLocationId) {
          throw new Error('AssetModel does not belong to lending location');
        }

        const trackingType = model.trackingType || 'serialized';
        if (trackingType === 'bulk' || kind === 'bulk') {
          await this.availabilityService.assertAvailability(model.id, data.reservedFrom, data.reservedUntil, quantity);
          await this.inventoryStockService.decreaseAvailable(model.id, data.lendingLocationId, quantity, { transaction });
          await LoanItem.create(
            {
              loanId: loan.id,
              assetId: null,
              assetModelId: model.id,
              quantity,
              itemType: 'bulk',
              status: 'reserved',
              conditionOnHandover: item.conditionOnHandover || null,
            },
            { transaction }
          );
          continue;
        }

        await this.availabilityService.assertAvailability(model.id, data.reservedFrom, data.reservedUntil, quantity);
        if (assetId) {
          quantity = 1;
        }
        for (let i = 0; i < quantity; i += 1) {
          await LoanItem.create(
            {
              loanId: loan.id,
              assetId: assetId || null,
              assetModelId: model.id,
              quantity: 1,
              itemType: 'serialized',
              status: 'reserved',
              conditionOnHandover: item.conditionOnHandover || null,
            },
            { transaction }
          );
        }
      }

      await LoanEvent.create(
        {
          loanId: loan.id,
          userId: data.userId,
          type: 'reserved',
          note: data.notes || null,
        },
        { transaction }
      );

      return loan;
    });
  }

  async getById(id) {
    const loan = await this.models.Loan.findByPk(id, {
      include: [
        { model: this.models.User, as: 'user' },
        { model: this.models.LendingLocation, as: 'lendingLocation' },
        {
          model: this.models.LoanItem,
          as: 'loanItems',
          include: [
            {
              model: this.models.Asset,
              as: 'asset',
              include: [
                {
                  model: this.models.AssetModel,
                  as: 'model',
                  include: [{ model: this.models.Manufacturer, as: 'manufacturer' }],
                },
              ],
            },
            {
              model: this.models.AssetModel,
              as: 'assetModel',
              include: [{ model: this.models.Manufacturer, as: 'manufacturer' }],
            },
          ],
        },
        {
          model: this.models.LoanSignature,
          as: 'loanSignatures',
          include: [{ model: this.models.User, as: 'user' }],
          separate: true,
          order: [['signedAt', 'DESC'], ['createdAt', 'DESC']],
        },
        {
          model: this.models.LoanEvent,
          as: 'events',
          include: [{ model: this.models.User, as: 'user' }],
          separate: true,
          order: [['occurredAt', 'DESC'], ['createdAt', 'DESC']],
        },
      ],
    });
    if (!loan) {
      throw new Error('Loan not found');
    }
    return loan;
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    if (filter.userId) {
      where.userId = filter.userId;
    }
    if (filter.lendingLocationId) {
      where.lendingLocationId = filter.lendingLocationId;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    const listOptions = buildListOptions(options);
    if (options.include) {
      listOptions.include = options.include;
    }
    return this.models.Loan.findAll({ where, ...listOptions });
  }

  async cancelLoan(loanId, userId, note) {
    const { Loan, LoanItem, LoanEvent, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (loan.status !== 'reserved') {
        throw new Error('Loan cannot be cancelled');
      }
      const items = await LoanItem.findAll({ where: { loanId }, transaction });
      await this.#releaseBulkItems(items, loan.lendingLocationId, transaction);
      await loan.update({ status: 'cancelled' }, { transaction });
      await LoanEvent.create(
        {
          loanId: loan.id,
          userId: userId || null,
          type: 'cancelled',
          note: note || null,
        },
        { transaction }
      );
      return loan;
    });
  }

  async handOverLoan(loanId, data) {
    const {
      Loan,
      LoanItem,
      LoanEvent,
      CustomFieldDefinition,
      CustomFieldValue,
      Asset,
      AssetModel,
      sequelize,
    } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (loan.status !== 'reserved') {
        throw new Error('Loan cannot be handed over');
      }

      const items = await LoanItem.findAll({ where: { loanId }, transaction });
      if (!items.length) {
        throw new Error('Loan has no items');
      }

      for (const item of items) {
        const input = Array.isArray(data.items)
          ? data.items.find((i) => i.loanItemId === item.id)
          : null;
        const model = item.assetModelId ? await AssetModel.findByPk(item.assetModelId, { transaction }) : null;
        const trackingType = model ? (model.trackingType || 'serialized') : 'serialized';
        const requiresAsset =
          item.itemType === 'serialized' ||
          (item.itemType === 'bundle_component' && trackingType === 'serialized');
        let assetId = input && input.assetId ? input.assetId : item.assetId;
        if (requiresAsset) {
          if (!assetId) {
            throw new Error('Asset is required for handover');
          }
          const asset = await Asset.findByPk(assetId, { transaction });
          if (!asset) {
            throw new Error('Asset not found');
          }
          if (asset.lendingLocationId !== loan.lendingLocationId) {
            throw new Error('Asset does not belong to lending location');
          }
          if (asset.assetModelId !== item.assetModelId) {
            throw new Error('Asset does not match reserved model');
          }
        } else {
          assetId = null;
        }
        await item.update(
          {
            assetId,
            status: 'handed_over',
            handedOverAt: data.handedOverAt || new Date(),
            conditionOnHandover: input && input.conditionOnHandover ? input.conditionOnHandover : item.conditionOnHandover,
          },
          { transaction }
        );
      }

      const itemsWithAssets = items.filter((item) => Boolean(item.assetId));
      await this.#assertRequiredCustomFields(itemsWithAssets, {
        Asset,
        CustomFieldDefinition,
        CustomFieldValue,
        transaction,
      });

      await loan.update(
        {
          status: 'handed_over',
          handedOverAt: data.handedOverAt || new Date(),
        },
        { transaction }
      );

      await LoanEvent.create(
        {
          loanId: loan.id,
          userId: data.userId || null,
          type: 'handed_over',
          note: data.note || null,
        },
        { transaction }
      );

      return loan;
    });
  }

  async returnLoan(loanId, data) {
    const { Loan, LoanItem, LoanEvent, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (!['handed_over', 'overdue'].includes(loan.status)) {
        throw new Error('Loan cannot be returned');
      }

      await assertOpenAt(this.models, loan.lendingLocationId, data.returnedAt || new Date(), 'return');

      const items = await LoanItem.findAll({ where: { loanId }, transaction });
      if (!items.length) {
        throw new Error('Loan has no items');
      }

      for (const item of items) {
        const input = Array.isArray(data.items)
          ? data.items.find((i) => i.loanItemId === item.id)
          : null;
        await item.update(
          {
            status: 'returned',
            returnedAt: data.returnedAt || new Date(),
            conditionOnReturn: input && input.conditionOnReturn ? input.conditionOnReturn : item.conditionOnReturn,
          },
          { transaction }
        );
      }

      await this.#releaseBulkItems(items, loan.lendingLocationId, transaction);

      await loan.update(
        {
          status: 'returned',
          returnedAt: data.returnedAt || new Date(),
        },
        { transaction }
      );

      await LoanEvent.create(
        {
          loanId: loan.id,
          userId: data.userId || null,
          type: 'returned',
          note: data.note || null,
        },
        { transaction }
      );

      return loan;
    });
  }

  async addLoanItems(loanId, data) {
    const { Loan, LoanItem, AssetModel, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (loan.status !== 'reserved') {
        throw new Error('Loan cannot be modified');
      }

      const assetModelId = data.assetModelId;
      const quantity = Math.max(parseInt(data.quantity || '1', 10), 1);
      if (!assetModelId) {
        throw new Error('AssetModel is required');
      }

      const model = await AssetModel.findByPk(assetModelId, { transaction });
      if (!model) {
        throw new Error('AssetModel not found');
      }
      if (model.lendingLocationId !== loan.lendingLocationId) {
        throw new Error('AssetModel does not belong to lending location');
      }

      const trackingType = model.trackingType || 'serialized';
      await this.availabilityService.assertAvailability(assetModelId, loan.reservedFrom, loan.reservedUntil, quantity);
      if (trackingType === 'bulk') {
        await this.inventoryStockService.decreaseAvailable(assetModelId, loan.lendingLocationId, quantity, { transaction });
        await LoanItem.create(
          {
            loanId: loan.id,
            assetId: null,
            assetModelId,
            quantity,
            itemType: 'bulk',
            status: 'reserved',
          },
          { transaction }
        );
      } else {
        for (let i = 0; i < quantity; i += 1) {
          await LoanItem.create(
            {
              loanId: loan.id,
              assetId: null,
              assetModelId,
              quantity: 1,
              itemType: 'serialized',
              status: 'reserved',
            },
            { transaction }
          );
        }
      }
      return loan;
    });
  }

  async updateLoanPeriod(loanId, data) {
    const { Loan, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (!['reserved', 'handed_over', 'overdue'].includes(loan.status)) {
        throw new Error('Loan period cannot be changed in current status');
      }
      if (!data.reservedFrom || !data.reservedUntil) {
        throw new Error('Reserved from and until are required');
      }
      if (!data.skipOpeningHours) {
        await assertOpenForRange(this.models, loan.lendingLocationId, data.reservedFrom, data.reservedUntil);
      }

      await loan.update(
        {
          reservedFrom: data.reservedFrom,
          reservedUntil: data.reservedUntil,
        },
        { transaction }
      );
      return loan;
    });
  }

  async updateLoanItemModel(loanId, loanItemId, assetModelId) {
    const { Loan, LoanItem, AssetModel, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (loan.status !== 'reserved') {
        throw new Error('Loan cannot be modified');
      }

      const item = await LoanItem.findOne({ where: { id: loanItemId, loanId }, transaction });
      if (!item) {
        throw new Error('LoanItem not found');
      }

      const model = await AssetModel.findByPk(assetModelId, { transaction });
      if (!model) {
        throw new Error('AssetModel not found');
      }
      if (model.lendingLocationId !== loan.lendingLocationId) {
        throw new Error('AssetModel does not belong to lending location');
      }

      await this.availabilityService.assertAvailability(assetModelId, loan.reservedFrom, loan.reservedUntil, 1);

      const trackingType = model.trackingType || 'serialized';
      await item.update(
        {
          assetModelId,
          assetId: null,
          quantity: trackingType === 'bulk' ? Math.max(parseInt(item.quantity || '1', 10), 1) : 1,
          itemType: trackingType === 'bulk' ? 'bulk' : 'serialized',
          bundleDefinitionId: null,
          parentLoanItemId: null,
          status: 'reserved',
          conditionOnHandover: null,
        },
        { transaction }
      );
      return item;
    });
  }

  async returnLoanItems(loanId, data) {
    const { Loan, LoanItem, LoanEvent, Asset, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (!['handed_over', 'overdue'].includes(loan.status)) {
        throw new Error('Loan cannot be returned');
      }

      const selectedItemIds = Array.isArray(data.itemIds)
        ? data.itemIds.filter(Boolean)
        : data.itemIds
          ? [data.itemIds]
          : [];
      if (!selectedItemIds.length) {
        throw new Error('At least one item is required');
      }

      const items = await LoanItem.findAll({
        where: { loanId, id: selectedItemIds },
        include: [{ model: Asset, as: 'asset' }],
        transaction,
      });
      if (!items.length) {
        throw new Error('Loan items not found');
      }

      const now = data.returnedAt || new Date();
      const byId = {};
      if (Array.isArray(data.items)) {
        data.items.forEach((entry) => {
          if (entry && entry.loanItemId) byId[entry.loanItemId] = entry;
        });
      }
      for (const item of items) {
        const payload = byId[item.id] || {};
        await item.update(
          {
            status: 'returned',
            returnedAt: now,
            conditionOnReturn: payload.conditionOnReturn || item.conditionOnReturn || null,
          },
          { transaction }
        );
        if (item.asset) {
          const isActive = payload.assetStatus === 'inactive' ? false : true;
          await item.asset.update({ isActive }, { transaction });
        }
      }

      await this.#releaseBulkItems(items, loan.lendingLocationId, transaction);

      const remaining = await LoanItem.count({
        where: {
          loanId,
          status: { [Op.in]: ['reserved', 'handed_over', 'overdue'] },
        },
        transaction,
      });
      if (remaining === 0) {
        await loan.update(
          {
            status: 'returned',
            returnedAt: now,
          },
          { transaction }
        );
      }

      await LoanEvent.create(
        {
          loanId: loan.id,
          userId: data.userId || null,
          type: 'returned',
          note: data.note || null,
        },
        { transaction }
      );

      return loan;
    });
  }

  async removeLoanItem(loanId, loanItemId) {
    const { Loan, LoanItem, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (loan.status !== 'reserved') {
        throw new Error('Loan cannot be modified');
      }
      const item = await LoanItem.findOne({ where: { id: loanItemId, loanId }, transaction });
      if (!item) {
        throw new Error('LoanItem not found');
      }
      if (item.status === 'reserved') {
        await this.#releaseBulkItems([item], loan.lendingLocationId, transaction);
      }
      await item.destroy({ transaction });
      return loan;
    });
  }

  async markOverdue(loanId) {
    const loan = await this.models.Loan.findByPk(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }
    if (!['reserved', 'handed_over'].includes(loan.status)) {
      throw new Error('Loan cannot be marked overdue');
    }
    await loan.update({ status: 'overdue' });
    await this.models.LoanEvent.create({
      loanId: loan.id,
      userId: null,
      type: 'overdue',
      note: null,
    });
    return loan;
  }

  async deleteLoan(loanId) {
    const loan = await this.getById(loanId);
    await loan.destroy();
    return true;
  }

  async #assertRequiredCustomFields(items, ctx) {
    const { Asset, CustomFieldDefinition, CustomFieldValue, transaction } = ctx;
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }
    const assetIds = items.map((item) => item.assetId).filter(Boolean);
    if (!assetIds.length) {
      return;
    }
    const assets = await Asset.findAll({ where: { id: assetIds }, transaction });
    const definitions = await CustomFieldDefinition.findAll({
      where: { isActive: true },
      transaction,
    });
    for (const item of items) {
      const asset = assets.find((a) => a.id === item.assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }
      const applicable = definitions.filter((def) => {
        if (def.scope === 'asset_model') {
          return def.assetModelId === asset.assetModelId;
        }
        if (def.scope === 'lending_location') {
          return def.lendingLocationId === asset.lendingLocationId;
        }
        return false;
      });
      const requiredDefs = applicable.filter((def) => def.required);
      if (!requiredDefs.length) {
        continue;
      }
      const values = await CustomFieldValue.findAll({
        where: { assetInstanceId: asset.id },
        transaction,
      });
      for (const def of requiredDefs) {
        const value = values.find((v) => v.customFieldDefinitionId === def.id);
        if (!value) {
          throw new Error('Required custom field is missing');
        }
      }
    }
  }

  async #releaseBulkItems(items, lendingLocationId, transaction) {
    if (!Array.isArray(items) || !items.length) {
      return;
    }
    for (const item of items) {
      const isBulk =
        item.itemType === 'bulk' ||
        (item.itemType === 'bundle_component' && !item.assetId && item.assetModelId);
      if (!isBulk) {
        continue;
      }
      const qty = Math.max(parseInt(item.quantity || '1', 10), 1);
      if (!item.assetModelId) {
        continue;
      }
      await this.inventoryStockService.increaseAvailable(item.assetModelId, lendingLocationId, qty, { transaction });
    }
  }
}

module.exports = LoanService;
