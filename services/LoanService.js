const { buildListOptions } = require('./serviceUtils');
const { assertOpenForRange, assertOpenAt } = require('../utils/openingHours');
const { Op } = require('sequelize');
const {
  LOAN_STATUS,
  LOAN_ITEM_STATUS,
  LOAN_ITEM_TYPE,
  LOAN_EVENT_TYPE,
  TRACKING_TYPE,
} = require('../config/dbConstants');
const { DEFAULT_ITEM_QUANTITY, parsePositiveQuantity } = require('../utils/quantity');

const TRANSITION_ALLOWED_STATUSES = Object.freeze({
  CANCEL: [LOAN_STATUS.RESERVED],
  HAND_OVER: [LOAN_STATUS.RESERVED],
  RETURN: [LOAN_STATUS.HANDED_OVER, LOAN_STATUS.OVERDUE],
  MODIFY_RESERVED: [LOAN_STATUS.RESERVED],
  UPDATE_PERIOD: [LOAN_STATUS.RESERVED, LOAN_STATUS.HANDED_OVER, LOAN_STATUS.OVERDUE],
  MARK_OVERDUE: [LOAN_STATUS.RESERVED, LOAN_STATUS.HANDED_OVER],
});

const OPEN_LOAN_ITEM_STATUSES = Object.freeze([
  LOAN_ITEM_STATUS.RESERVED,
  LOAN_ITEM_STATUS.HANDED_OVER,
]);

class LoanService {
  constructor(models, availabilityService, inventoryStockService, bundleService) {
    this.models = models;
    if (availabilityService) {
      this.availabilityService = availabilityService;
    } else {
      const AvailabilityService = require('./availabilityService');
      this.availabilityService = new AvailabilityService(models);
    }
    if (inventoryStockService) {
      this.inventoryStockService = inventoryStockService;
    } else {
      const InventoryStockService = require('./inventoryStockService');
      this.inventoryStockService = new InventoryStockService(models);
    }
    if (bundleService) {
      this.bundleService = bundleService;
    } else {
      const BundleService = require('./bundleService');
      this.bundleService = new BundleService(models, this.availabilityService, this.inventoryStockService);
    }
  }

  #assertTransitionAllowed(loan, allowedStatuses, errorMessage) {
    if (!allowedStatuses.includes(loan.status)) {
      throw new Error(errorMessage);
    }
  }

  #buildLoanItemInputMap(items) {
    const map = new Map();
    if (!Array.isArray(items)) {
      return map;
    }
    items.forEach((item) => {
      if (item && item.loanItemId) {
        map.set(item.loanItemId, item);
      }
    });
    return map;
  }

  #buildReservationCommand(data) {
    return {
      userId: data.userId,
      lendingLocationId: data.lendingLocationId,
      reservedFrom: data.reservedFrom,
      reservedUntil: data.reservedUntil,
      notes: data.notes || null,
      items: Array.isArray(data.items) ? data.items : [],
    };
  }

  #buildHandOverCommand(loanId, data) {
    return {
      loanId,
      userId: data.userId || null,
      handedOverAt: data.handedOverAt || new Date(),
      note: data.note || null,
      items: Array.isArray(data.items) ? data.items : [],
    };
  }

  #buildReturnCommand(loanId, data) {
    let itemIds = [];
    if (Array.isArray(data.itemIds)) {
      itemIds = data.itemIds.filter(Boolean);
    } else if (data.itemIds) {
      itemIds = [data.itemIds];
    }

    return {
      loanId,
      userId: data.userId || null,
      returnedAt: data.returnedAt || new Date(),
      note: data.note || null,
      items: Array.isArray(data.items) ? data.items : [],
      itemIds,
    };
  }

  #buildUpdatePeriodCommand(loanId, data) {
    return {
      loanId,
      reservedFrom: data.reservedFrom,
      reservedUntil: data.reservedUntil,
      skipOpeningHours: Boolean(data.skipOpeningHours),
    };
  }

  async #recordLoanEvent(command, transaction) {
    await this.models.LoanEvent.create(
      {
        loanId: command.loanId,
        userId: command.userId || null,
        type: command.type,
        note: command.note || null,
      },
      { transaction }
    );
  }

  #buildReservationContext(reservationCommand, loan, transaction) {
    return {
      reservationCommand,
      loan,
      transaction,
      lendingLocationId: reservationCommand.lendingLocationId,
      reservedFrom: reservationCommand.reservedFrom,
      reservedUntil: reservationCommand.reservedUntil,
    };
  }

  async #loadLoanForTransition(Loan, loanId, allowedStatuses, errorMessage, transaction) {
    const loan = await Loan.findByPk(loanId, { transaction });
    if (!loan) {
      throw new Error('Loan not found');
    }
    this.#assertTransitionAllowed(loan, allowedStatuses, errorMessage);
    return loan;
  }

  async #loadLoanItemsOrThrow(LoanItem, query, transaction, emptyMessage) {
    const items = await LoanItem.findAll({ ...query, transaction });
    if (!items.length) {
      throw new Error(emptyMessage);
    }
    return items;
  }

  async #finalizeLoanAsReturned(loan, returnCommand, transaction) {
    await loan.update(
      {
        status: LOAN_STATUS.RETURNED,
        returnedAt: returnCommand.returnedAt,
      },
      { transaction }
    );
  }

  async #recordReturnedEvent(loanId, returnCommand, transaction) {
    await this.#recordLoanEvent(
      {
        loanId,
        userId: returnCommand.userId,
        type: LOAN_EVENT_TYPE.RETURNED,
        note: returnCommand.note,
      },
      transaction
    );
  }

  async #loadAssetModelForLendingLocation(assetModelId, lendingLocationId, transaction) {
    const { AssetModel } = this.models;
    const model = await AssetModel.findByPk(assetModelId, { transaction });
    if (!model) {
      throw new Error('AssetModel not found');
    }
    if (model.lendingLocationId !== lendingLocationId) {
      throw new Error('AssetModel does not belong to lending location');
    }
    return model;
  }

  async #assertModelAvailableForLoan(assetModelId, loan, quantity) {
    await this.availabilityService.assertAvailability(
      assetModelId,
      loan.reservedFrom,
      loan.reservedUntil,
      quantity
    );
  }

  async #resolveReservationItemTarget(item, reservationCommand, transaction) {
    const { Asset } = this.models;
    let selectedAssetId = item.assetId || null;
    let assetModelId = item.assetModelId || null;

    if (selectedAssetId) {
      const asset = await Asset.findByPk(selectedAssetId, { transaction });
      if (!asset) {
        throw new Error('Asset not found');
      }
      if (asset.lendingLocationId !== reservationCommand.lendingLocationId) {
        throw new Error('Asset does not belong to lending location');
      }
      assetModelId = asset.assetModelId;
    }

    if (!assetModelId) {
      throw new Error('AssetModel is required');
    }

    const model = await this.#loadAssetModelForLendingLocation(
      assetModelId,
      reservationCommand.lendingLocationId,
      transaction
    );

    return { model, selectedAssetId };
  }

  async #reserveBundleItem(item, reservationContext) {
    const bundleDefinition = await this.models.BundleDefinition.findByPk(item.bundleDefinitionId, {
      transaction: reservationContext.transaction,
    });
    if (!bundleDefinition) {
      throw new Error('BundleDefinition not found');
    }
    const bundleLocationId = bundleDefinition.lendingLocationId || reservationContext.lendingLocationId;
    if (bundleLocationId !== reservationContext.lendingLocationId) {
      throw new Error('BundleDefinition does not belong to lending location');
    }
    await this.bundleService.reserveBundleComponents(
      {
        loanId: reservationContext.loan.id,
        bundleDefinitionId: bundleDefinition.id,
        lendingLocationId: reservationContext.lendingLocationId,
        reservedFrom: reservationContext.reservedFrom,
        reservedUntil: reservationContext.reservedUntil,
        status: LOAN_ITEM_STATUS.RESERVED,
      },
      { transaction: reservationContext.transaction }
    );
  }

  async #reserveBulkItem(item, assetModel, reservationContext) {
    const quantity = parsePositiveQuantity(item.quantity, DEFAULT_ITEM_QUANTITY);
    await this.availabilityService.assertAvailability(
      assetModel.id,
      reservationContext.reservedFrom,
      reservationContext.reservedUntil,
      quantity
    );
    await this.inventoryStockService.decreaseAvailable(
      assetModel.id,
      reservationContext.lendingLocationId,
      quantity,
      { transaction: reservationContext.transaction }
    );
    await this.models.LoanItem.create(
      {
        loanId: reservationContext.loan.id,
        assetId: null,
        assetModelId: assetModel.id,
        quantity,
        itemType: LOAN_ITEM_TYPE.BULK,
        status: LOAN_ITEM_STATUS.RESERVED,
        conditionOnHandover: item.conditionOnHandover || null,
      },
      { transaction: reservationContext.transaction }
    );
  }

  async #reserveSerializedItems(item, assetModel, selectedAssetId, reservationContext) {
    let quantity = parsePositiveQuantity(item.quantity, DEFAULT_ITEM_QUANTITY);
    await this.availabilityService.assertAvailability(
      assetModel.id,
      reservationContext.reservedFrom,
      reservationContext.reservedUntil,
      quantity
    );
    if (selectedAssetId) {
      quantity = DEFAULT_ITEM_QUANTITY;
    }
    for (let index = 0; index < quantity; index += 1) {
      await this.models.LoanItem.create(
        {
          loanId: reservationContext.loan.id,
          assetId: selectedAssetId || null,
          assetModelId: assetModel.id,
          quantity: DEFAULT_ITEM_QUANTITY,
          itemType: LOAN_ITEM_TYPE.SERIALIZED,
          status: LOAN_ITEM_STATUS.RESERVED,
          conditionOnHandover: item.conditionOnHandover || null,
        },
        { transaction: reservationContext.transaction }
      );
    }
  }

  async createReservation(data) {
    const { Loan, User, LendingLocation, sequelize } = this.models;
    const reservationCommand = this.#buildReservationCommand(data);
    // All state changes inside this block are transactional; emit side effects only after commit.
    return sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(reservationCommand.userId, { transaction });
      if (!user) {
        throw new Error('User not found');
      }
      const location = await LendingLocation.findByPk(reservationCommand.lendingLocationId, { transaction });
      if (!location) {
        throw new Error('LendingLocation not found');
      }
      if (reservationCommand.items.length === 0) {
        throw new Error('At least one item is required');
      }

      await assertOpenForRange(
        this.models,
        reservationCommand.lendingLocationId,
        reservationCommand.reservedFrom,
        reservationCommand.reservedUntil
      );

      const loan = await Loan.create(
        {
          userId: reservationCommand.userId,
          lendingLocationId: reservationCommand.lendingLocationId,
          status: LOAN_STATUS.RESERVED,
          reservedFrom: reservationCommand.reservedFrom,
          reservedUntil: reservationCommand.reservedUntil,
          notes: reservationCommand.notes,
        },
        { transaction }
      );
      const reservationContext = this.#buildReservationContext(reservationCommand, loan, transaction);

      for (const item of reservationCommand.items) {
        const kind = String(item.kind || '').trim().toLowerCase();
        if (kind === 'bundle' || item.bundleDefinitionId) {
          await this.#reserveBundleItem(item, reservationContext);
          continue;
        }

        const { model, selectedAssetId } = await this.#resolveReservationItemTarget(
          item,
          reservationCommand,
          transaction
        );

        const trackingType = model.trackingType || TRACKING_TYPE.SERIALIZED;
        if (trackingType === TRACKING_TYPE.BULK || kind === TRACKING_TYPE.BULK) {
          await this.#reserveBulkItem(item, model, reservationContext);
          continue;
        }

        await this.#reserveSerializedItems(item, model, selectedAssetId, reservationContext);
      }

      await this.#recordLoanEvent(
        {
          loanId: loan.id,
          userId: reservationCommand.userId,
          type: LOAN_EVENT_TYPE.RESERVED,
          note: reservationCommand.notes,
        },
        transaction
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
    const { Loan, LoanItem, sequelize } = this.models;
    // All state changes inside this block are transactional; emit side effects only after commit.
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      this.#assertTransitionAllowed(loan, TRANSITION_ALLOWED_STATUSES.CANCEL, 'Loan cannot be cancelled');
      const items = await LoanItem.findAll({ where: { loanId }, transaction });
      await this.#releaseBulkItems(items, loan.lendingLocationId, transaction);
      await loan.update({ status: LOAN_STATUS.CANCELLED }, { transaction });
      await this.#recordLoanEvent(
        {
          loanId: loan.id,
          userId: userId || null,
          type: LOAN_EVENT_TYPE.CANCELLED,
          note: note || null,
        },
        transaction
      );
      return loan;
    });
  }

  async #transitionItemsForHandOver(items, handOverCommand, loan, transaction) {
    const { Asset, AssetModel } = this.models;
    const itemInputMap = this.#buildLoanItemInputMap(handOverCommand.items);

    // Keep loan item status invariants in sync.
    for (const item of items) {
      const itemInput = itemInputMap.get(item.id) || null;
      const model = item.assetModelId ? await AssetModel.findByPk(item.assetModelId, { transaction }) : null;
      const trackingType = model ? (model.trackingType || TRACKING_TYPE.SERIALIZED) : TRACKING_TYPE.SERIALIZED;
      const requiresAsset =
        item.itemType === LOAN_ITEM_TYPE.SERIALIZED ||
        (item.itemType === LOAN_ITEM_TYPE.BUNDLE_COMPONENT && trackingType === TRACKING_TYPE.SERIALIZED);

      let assetId = itemInput && itemInput.assetId ? itemInput.assetId : item.assetId;
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
          status: LOAN_ITEM_STATUS.HANDED_OVER,
          handedOverAt: handOverCommand.handedOverAt,
          conditionOnHandover:
            itemInput && itemInput.conditionOnHandover
              ? itemInput.conditionOnHandover
              : item.conditionOnHandover,
        },
        { transaction }
      );
    }
  }

  async #transitionItemsForReturn(items, returnCommand, transaction, updateAssetStatus) {
    const itemInputMap = this.#buildLoanItemInputMap(returnCommand.items);
    // Keep loan item status invariants in sync.
    for (const item of items) {
      const itemInput = itemInputMap.get(item.id) || {};
      await item.update(
        {
          status: LOAN_ITEM_STATUS.RETURNED,
          returnedAt: returnCommand.returnedAt,
          conditionOnReturn: itemInput.conditionOnReturn || item.conditionOnReturn,
        },
        { transaction }
      );

      if (updateAssetStatus && item.asset) {
        const isActive = itemInput.assetStatus === 'inactive' ? false : true;
        await item.asset.update({ isActive }, { transaction });
      }
    }
  }

  async handOverLoan(loanId, data) {
    const {
      Loan,
      LoanItem,
      CustomFieldDefinition,
      CustomFieldValue,
      Asset,
      sequelize,
    } = this.models;
    const handOverCommand = this.#buildHandOverCommand(loanId, data);
    // All state changes inside this block are transactional; emit side effects only after commit.
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      this.#assertTransitionAllowed(loan, TRANSITION_ALLOWED_STATUSES.HAND_OVER, 'Loan cannot be handed over');

      const items = await LoanItem.findAll({ where: { loanId }, transaction });
      if (!items.length) {
        throw new Error('Loan has no items');
      }

      await this.#transitionItemsForHandOver(items, handOverCommand, loan, transaction);

      const itemsWithAssets = items.filter((item) => Boolean(item.assetId));
      // Required custom fields are enforced at handover to prevent incomplete asset metadata leaving inventory.
      await this.#assertRequiredCustomFields(itemsWithAssets, {
        Asset,
        CustomFieldDefinition,
        CustomFieldValue,
        transaction,
      });

      await loan.update(
        {
          status: LOAN_STATUS.HANDED_OVER,
          handedOverAt: handOverCommand.handedOverAt,
        },
        { transaction }
      );

      await this.#recordLoanEvent(
        {
          loanId: loan.id,
          userId: handOverCommand.userId,
          type: LOAN_EVENT_TYPE.HANDED_OVER,
          note: handOverCommand.note,
        },
        transaction
      );

      return loan;
    });
  }

  async returnLoan(loanId, data) {
    const { Loan, LoanItem, sequelize } = this.models;
    const returnCommand = this.#buildReturnCommand(loanId, data);
    // All state changes inside this block are transactional; emit side effects only after commit.
    return sequelize.transaction(async (transaction) => {
      const loan = await this.#loadLoanForTransition(
        Loan,
        loanId,
        TRANSITION_ALLOWED_STATUSES.RETURN,
        'Loan cannot be returned',
        transaction
      );

      await assertOpenAt(this.models, loan.lendingLocationId, returnCommand.returnedAt, 'return');

      const items = await this.#loadLoanItemsOrThrow(
        LoanItem,
        { where: { loanId } },
        transaction,
        'Loan has no items'
      );

      await this.#transitionItemsForReturn(items, returnCommand, transaction, false);

      await this.#releaseBulkItems(items, loan.lendingLocationId, transaction);

      await this.#finalizeLoanAsReturned(loan, returnCommand, transaction);
      await this.#recordReturnedEvent(loan.id, returnCommand, transaction);

      return loan;
    });
  }

  async addLoanItems(loanId, data) {
    const { Loan, LoanItem, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await this.#loadLoanForTransition(
        Loan,
        loanId,
        TRANSITION_ALLOWED_STATUSES.MODIFY_RESERVED,
        'Loan cannot be modified',
        transaction
      );

      const assetModelId = data.assetModelId;
      const quantity = parsePositiveQuantity(data.quantity, DEFAULT_ITEM_QUANTITY);
      if (!assetModelId) {
        throw new Error('AssetModel is required');
      }

      const model = await this.#loadAssetModelForLendingLocation(
        assetModelId,
        loan.lendingLocationId,
        transaction
      );

      const trackingType = model.trackingType || TRACKING_TYPE.SERIALIZED;
      await this.#assertModelAvailableForLoan(assetModelId, loan, quantity);
      if (trackingType === TRACKING_TYPE.BULK) {
        await this.inventoryStockService.decreaseAvailable(assetModelId, loan.lendingLocationId, quantity, { transaction });
        await LoanItem.create(
          {
            loanId: loan.id,
            assetId: null,
            assetModelId,
            quantity,
            itemType: LOAN_ITEM_TYPE.BULK,
            status: LOAN_ITEM_STATUS.RESERVED,
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
              quantity: DEFAULT_ITEM_QUANTITY,
              itemType: LOAN_ITEM_TYPE.SERIALIZED,
              status: LOAN_ITEM_STATUS.RESERVED,
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
    const updatePeriodCommand = this.#buildUpdatePeriodCommand(loanId, data);
    // All state changes inside this block are transactional; emit side effects only after commit.
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(updatePeriodCommand.loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (!TRANSITION_ALLOWED_STATUSES.UPDATE_PERIOD.includes(loan.status)) {
        throw new Error('Loan period cannot be changed in current status');
      }
      if (!updatePeriodCommand.reservedFrom || !updatePeriodCommand.reservedUntil) {
        throw new Error('Reserved from and until are required');
      }
      if (!updatePeriodCommand.skipOpeningHours) {
        await assertOpenForRange(
          this.models,
          loan.lendingLocationId,
          updatePeriodCommand.reservedFrom,
          updatePeriodCommand.reservedUntil
        );
      }

      await loan.update(
        {
          reservedFrom: updatePeriodCommand.reservedFrom,
          reservedUntil: updatePeriodCommand.reservedUntil,
        },
        { transaction }
      );
      return loan;
    });
  }

  async updateLoanItemModel(loanId, loanItemId, assetModelId) {
    const { Loan, LoanItem, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await this.#loadLoanForTransition(
        Loan,
        loanId,
        TRANSITION_ALLOWED_STATUSES.MODIFY_RESERVED,
        'Loan cannot be modified',
        transaction
      );

      const item = await LoanItem.findOne({ where: { id: loanItemId, loanId }, transaction });
      if (!item) {
        throw new Error('LoanItem not found');
      }

      const model = await this.#loadAssetModelForLendingLocation(
        assetModelId,
        loan.lendingLocationId,
        transaction
      );

      await this.#assertModelAvailableForLoan(
        assetModelId,
        loan,
        DEFAULT_ITEM_QUANTITY
      );

      const trackingType = model.trackingType || TRACKING_TYPE.SERIALIZED;
      const loanItemMutationCommand = this.#buildLoanItemMutationCommand({
        assetModelId,
        trackingType,
        previousQuantity: item.quantity,
      });
      await item.update(loanItemMutationCommand, { transaction });
      return item;
    });
  }

  #buildLoanItemMutationCommand(command) {
    const mutation = {
      assetModelId: command.assetModelId,
      assetId: null,
      bundleDefinitionId: null,
      parentLoanItemId: null,
      status: LOAN_ITEM_STATUS.RESERVED,
      conditionOnHandover: null,
    };

    if (command.trackingType === TRACKING_TYPE.BULK) {
      mutation.quantity = parsePositiveQuantity(
        command.previousQuantity,
        DEFAULT_ITEM_QUANTITY
      );
      mutation.itemType = LOAN_ITEM_TYPE.BULK;
      return mutation;
    }

    mutation.quantity = DEFAULT_ITEM_QUANTITY;
    mutation.itemType = LOAN_ITEM_TYPE.SERIALIZED;
    return mutation;
  }

  async removeLoanItem(loanId, loanItemId) {
    const { Loan, LoanItem, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      // This path only supports reserved loans; other statuses must fail fast.
      const loan = await this.#loadLoanForTransition(
        Loan,
        loanId,
        TRANSITION_ALLOWED_STATUSES.MODIFY_RESERVED,
        'Loan cannot be modified',
        transaction
      );
      const items = await this.#loadLoanItemsOrThrow(
        LoanItem,
        { where: { id: loanItemId, loanId } },
        transaction,
        'LoanItem not found'
      );
      const item = items[0];
      if (item.status === LOAN_ITEM_STATUS.RESERVED) {
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
    this.#assertTransitionAllowed(loan, TRANSITION_ALLOWED_STATUSES.MARK_OVERDUE, 'Loan cannot be marked overdue');
    await loan.update({ status: LOAN_STATUS.OVERDUE });
    await this.models.LoanEvent.create({
      loanId: loan.id,
      userId: null,
      type: LOAN_EVENT_TYPE.OVERDUE,
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
        item.itemType === LOAN_ITEM_TYPE.BULK ||
        (item.itemType === LOAN_ITEM_TYPE.BUNDLE_COMPONENT && !item.assetId && item.assetModelId);
      if (!isBulk) {
        continue;
      }
      const qty = parsePositiveQuantity(item.quantity, DEFAULT_ITEM_QUANTITY);
      if (!item.assetModelId) {
        continue;
      }
      await this.inventoryStockService.increaseAvailable(item.assetModelId, lendingLocationId, qty, { transaction });
    }
  }
  async returnLoanItems(loanId, data) {
    const { Loan, LoanItem, Asset, sequelize } = this.models;
    const returnCommand = this.#buildReturnCommand(loanId, data);
    // All state changes inside this block are transactional; emit side effects only after commit.
    return sequelize.transaction(async (transaction) => {
      const loan = await this.#loadLoanForTransition(
        Loan,
        loanId,
        TRANSITION_ALLOWED_STATUSES.RETURN,
        'Loan cannot be returned',
        transaction
      );

      const selectedItemIds = returnCommand.itemIds;
      if (!selectedItemIds.length) {
        throw new Error('At least one item is required');
      }

      const items = await this.#loadLoanItemsOrThrow(
        LoanItem,
        {
          where: { loanId, id: selectedItemIds },
          include: [{ model: Asset, as: 'asset' }],
        },
        transaction,
        'Loan items not found'
      );

      await this.#transitionItemsForReturn(items, returnCommand, transaction, true);

      await this.#releaseBulkItems(items, loan.lendingLocationId, transaction);

      const remaining = await LoanItem.count({
        where: {
          loanId,
          status: { [Op.in]: OPEN_LOAN_ITEM_STATUSES },
        },
        transaction,
      });
      if (remaining === 0) {
        await this.#finalizeLoanAsReturned(loan, returnCommand, transaction);
      }

      await this.#recordReturnedEvent(loan.id, returnCommand, transaction);

      return loan;
    });
  }

}

module.exports = LoanService;
