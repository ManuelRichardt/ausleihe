const { buildListOptions } = require('./_serviceUtils');
const { assertOpenForRange, assertOpenAt } = require('../utils/openingHours');
const { Op } = require('sequelize');

class LoanService {
  constructor(models, availabilityService) {
    this.models = models;
    if (availabilityService) {
      this.availabilityService = availabilityService;
    } else {
      const AvailabilityService = require('./AvailabilityService');
      this.availabilityService = new AvailabilityService(models);
    }
  }

  async createReservation(data) {
    const { Loan, LoanItem, LoanEvent, User, LendingLocation, Asset, AssetModel, sequelize } = this.models;
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

      const requestedByModel = new Map();
      const normalizedItems = [];
      for (const item of data.items) {
        let assetId = item.assetId || null;
        let assetModelId = item.assetModelId || null;
        const quantity = Math.max(parseInt(item.quantity || '1', 10), 1);

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

        requestedByModel.set(assetModelId, (requestedByModel.get(assetModelId) || 0) + quantity);
        normalizedItems.push({
          assetId,
          assetModelId,
          quantity,
          conditionOnHandover: item.conditionOnHandover || null,
        });
      }

      for (const [assetModelId, quantity] of requestedByModel.entries()) {
        await this.availabilityService.assertAvailability(assetModelId, data.reservedFrom, data.reservedUntil, quantity);
      }

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

      for (const item of normalizedItems) {
        for (let i = 0; i < item.quantity; i += 1) {
          await LoanItem.create(
            {
              loanId: loan.id,
              assetId: item.assetId,
              assetModelId: item.assetModelId,
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
        { model: this.models.LoanSignature, as: 'loanSignatures' },
        { model: this.models.LoanEvent, as: 'events' },
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
    const { Loan, LoanEvent, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (loan.status !== 'reserved') {
        throw new Error('Loan cannot be cancelled');
      }
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
        const assetId = input && input.assetId ? input.assetId : item.assetId;
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

      await this.#assertRequiredCustomFields(items, {
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

      await this.availabilityService.assertAvailability(
        assetModelId,
        loan.reservedFrom,
        loan.reservedUntil,
        quantity
      );

      for (let i = 0; i < quantity; i += 1) {
        await LoanItem.create(
          {
            loanId: loan.id,
            assetId: null,
            assetModelId,
            status: 'reserved',
          },
          { transaction }
        );
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
      if (loan.status !== 'reserved') {
        throw new Error('Loan period can only be changed for reserved loans');
      }
      if (!data.reservedFrom || !data.reservedUntil) {
        throw new Error('Reserved from and until are required');
      }
      await assertOpenForRange(this.models, loan.lendingLocationId, data.reservedFrom, data.reservedUntil);

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

      await item.update(
        {
          assetModelId,
          assetId: null,
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
      const returnedMeta = [];

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
        returnedMeta.push({
          loanItemId: item.id,
          conditionOnReturn: payload.conditionOnReturn || null,
          completeness: payload.completeness || null,
          assetStatus: payload.assetStatus || null,
        });
      }

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
          metadata: {
            returnedItemIds: selectedItemIds,
            items: returnedMeta,
          },
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
    const assetIds = items.map((item) => item.assetId);
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
}

module.exports = LoanService;
