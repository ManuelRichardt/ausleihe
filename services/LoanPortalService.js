const { LOAN_ITEM_TYPE, LOAN_ITEM_STATUS, LOAN_STATUS } = require('../config/dbConstants');

class LoanPortalService {
  constructor(models, loanService, assetModelService, assetInstanceService) {
    this.models = models;
    this.loanService = loanService;
    this.assetModelService = assetModelService;
    this.assetInstanceService = assetInstanceService;
  }

  #parseDateInput(value) {
    if (!value) {
      return null;
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  #parsePositiveQuantity(value, fallback = 1) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      return fallback;
    }
    return parsed;
  }

  #normalizeSelectedItems(items) {
    const rawItems = Array.isArray(items) ? items : [];
    const normalizedItems = [];
    const normalizedItemIndexByKey = new Map();
    rawItems.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }

      const kind = String(entry.kind || '').toLowerCase();
      if (kind === 'bulk' || (!entry.assetId && entry.assetModelId)) {
        const assetModelId = String(entry.assetModelId || entry.modelId || '').trim();
        if (!assetModelId) {
          return;
        }
        const key = `bulk:${assetModelId}`;
        const nextItem = {
          kind: 'bulk',
          assetModelId,
          quantity: this.#parsePositiveQuantity(entry.quantity, 1),
        };
        if (normalizedItemIndexByKey.has(key)) {
          normalizedItems[normalizedItemIndexByKey.get(key)] = nextItem;
          return;
        }
        normalizedItemIndexByKey.set(key, normalizedItems.length);
        normalizedItems.push(nextItem);
        return;
      }

      const assetId = String(entry.assetId || entry.id || '').trim();
      if (!assetId) {
        return;
      }
      const key = `serialized:${assetId}`;
      if (!normalizedItemIndexByKey.has(key)) {
        normalizedItemIndexByKey.set(key, normalizedItems.length);
        normalizedItems.push({
          kind: 'serialized',
          assetId,
          quantity: 1,
        });
      }
    });
    return normalizedItems;
  }

  #buildGuestUsername(firstName, lastName, email) {
    const source = [firstName, lastName, email]
      .filter(Boolean)
      .join('_')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    const base = source || 'gast';
    return `guest_${base}`;
  }

  async #resolveGuestUserId(payload) {
    const { User, sequelize } = this.models;
    const { Op } = this.models.Sequelize;
    const firstName = String(payload.guestFirstName || '').trim();
    const lastName = String(payload.guestLastName || '').trim();
    const email = String(payload.guestEmail || '').trim().toLowerCase();
    if (!firstName || !lastName || !email) {
      throw new Error('Vorname, Nachname und E-Mail sind erforderlich');
    }

    const existingByEmail = await User.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), {
        [Op.eq]: email,
      }),
      paranoid: false,
    });
    if (existingByEmail) {
      if (existingByEmail.deletedAt) {
        await existingByEmail.restore();
      }
      return {
        userId: existingByEmail.id,
        createdUserId: null,
      };
    }

    const baseUsername = this.#buildGuestUsername(firstName, lastName, email);
    let username = baseUsername;
    let counter = 0;
    while (counter < 100) {
      const existingByUsername = await User.findOne({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), {
          [Op.eq]: username.toLowerCase(),
        }),
        paranoid: false,
      });
      if (!existingByUsername) {
        break;
      }
      counter += 1;
      username = `${baseUsername}_${counter}`;
    }

    const created = await User.create({
      username,
      email,
      firstName,
      lastName,
      password: null,
      isActive: false,
    });
    return {
      userId: created.id,
      createdUserId: created.id,
    };
  }

  async #resolveLoanUser(payload) {
    const userId = String(payload.userId || '').trim();
    if (userId) {
      return {
        userId,
        createdUserId: null,
      };
    }
    return this.#resolveGuestUserId(payload);
  }

  #includes(options = {}) {
    const include = [
      { model: this.models.LendingLocation, as: 'lendingLocation' },
      {
        model: this.models.LoanItem,
        as: 'loanItems',
        include: [
          {
            model: this.models.AssetModel,
            as: 'assetModel',
            include: [
              { model: this.models.Manufacturer, as: 'manufacturer' },
              { model: this.models.AssetCategory, as: 'category' },
            ],
          },
          {
            model: this.models.Asset,
            as: 'asset',
            include: [
              {
                model: this.models.AssetModel,
                as: 'model',
                include: [
                  { model: this.models.Manufacturer, as: 'manufacturer' },
                  { model: this.models.AssetCategory, as: 'category' },
                ],
              },
            ],
          },
        ],
      },
    ];

    if (options.includeUser) {
      include.unshift({ model: this.models.User, as: 'user' });
    }

    return include;
  }

  #stripBundleRootLoanItems(loansOrLoan) {
    const stripFromLoan = (loan) => {
      if (!loan || !Array.isArray(loan.loanItems)) {
        return loan;
      }
      const visibleItems = loan.loanItems.filter(
        (item) => item && item.itemType !== LOAN_ITEM_TYPE.BUNDLE_ROOT
      );
      if (typeof loan.setDataValue === 'function') {
        loan.setDataValue('loanItems', visibleItems);
      }
      loan.loanItems = visibleItems;
      return loan;
    };

    if (Array.isArray(loansOrLoan)) {
      return loansOrLoan.map(stripFromLoan);
    }
    return stripFromLoan(loansOrLoan);
  }

  async #getUnavailableSerializedAssetIdsForLoan(loan) {
    if (!loan || !loan.id || !loan.lendingLocationId || !loan.reservedFrom || !loan.reservedUntil) {
      return new Set();
    }

    const { Op } = this.models.Sequelize;
    const { LoanItem, Loan } = this.models;
    const blockingItems = await LoanItem.findAll({
      where: {
        assetId: { [Op.ne]: null },
        status: { [Op.in]: [LOAN_ITEM_STATUS.RESERVED, LOAN_ITEM_STATUS.HANDED_OVER] },
      },
      attributes: ['assetId'],
      include: [
        {
          model: Loan,
          as: 'loan',
          required: true,
          where: {
            id: { [Op.ne]: loan.id },
            lendingLocationId: loan.lendingLocationId,
            [Op.or]: [
              { status: { [Op.in]: [LOAN_STATUS.HANDED_OVER, LOAN_STATUS.OVERDUE] } },
              {
                status: LOAN_STATUS.RESERVED,
                reservedFrom: { [Op.lt]: loan.reservedUntil },
                reservedUntil: { [Op.gt]: loan.reservedFrom },
              },
            ],
          },
        },
      ],
    });

    return new Set(
      blockingItems
        .map((item) => item.assetId)
        .filter(Boolean)
    );
  }

  async listForUser(userId, filter = {}) {
    const loans = await this.loanService.getAll(
      {
        userId,
        status: filter.status || undefined,
      },
      {
        include: this.#includes({ includeUser: false }),
        order: [['reservedFrom', 'DESC']],
      }
    );
    return this.#stripBundleRootLoanItems(loans);
  }

  async listForAdmin(lendingLocationId, filter = {}) {
    if (filter.status === 'today_returns') {
      const { Op } = this.models.Sequelize;
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      const loans = await this.models.Loan.findAll({
        where: {
          lendingLocationId,
          status: { [Op.in]: ['handed_over', 'overdue'] },
          reservedUntil: {
            [Op.gte]: todayStart,
            [Op.lte]: todayEnd,
          },
        },
        include: this.#includes({ includeUser: true }),
        order: [['reservedFrom', 'DESC']],
      });
      return this.#stripBundleRootLoanItems(loans);
    }

    if (filter.status === 'overdue') {
      const { Op } = this.models.Sequelize;
      const now = new Date();
      const loans = await this.models.Loan.findAll({
        where: {
          lendingLocationId,
          [Op.or]: [
            { status: 'overdue' },
            {
              status: 'handed_over',
              reservedUntil: { [Op.lt]: now },
            },
          ],
        },
        include: this.#includes({ includeUser: true }),
        order: [['reservedFrom', 'DESC']],
      });
      return this.#stripBundleRootLoanItems(loans);
    }

    const loans = await this.loanService.getAll(
      {
        lendingLocationId,
        status: filter.status || undefined,
      },
      {
        include: this.#includes({ includeUser: true }),
        order: [['reservedFrom', 'DESC']],
      }
    );
    return this.#stripBundleRootLoanItems(loans);
  }

  async getForUser(loanId, userId) {
    const loan = await this.loanService.getById(loanId);
    if (loan.userId !== userId) {
      const err = new Error('Loan not found');
      err.status = 404;
      throw err;
    }
    return loan;
  }

  async getForAdmin(loanId, lendingLocationId) {
    const loan = await this.loanService.getById(loanId);
    if (!lendingLocationId || loan.lendingLocationId !== lendingLocationId) {
      const err = new Error('Loan not found');
      err.status = 404;
      throw err;
    }
    return loan;
  }

  async getAdminContext(loanId, lendingLocationId) {
    const loan = await this.getForAdmin(loanId, lendingLocationId);
    const unavailableSerializedAssetIds = await this.#getUnavailableSerializedAssetIdsForLoan(loan);
    const modelIds = Array.from(
      new Set(
        (loan.loanItems || [])
          .map((item) => item.assetModelId || (item.asset && item.asset.assetModelId))
          .filter(Boolean)
      )
    );
    const assetsByModelId = {};
    if (modelIds.length) {
      const groups = await Promise.all(
        modelIds.map((modelId) =>
          this.assetInstanceService.getAll({
            assetModelId: modelId,
            lendingLocationId: loan.lendingLocationId,
            isActive: true,
          })
        )
      );
      modelIds.forEach((modelId, index) => {
        const assets = groups[index] || [];
        assetsByModelId[modelId] = assets.filter(
          (asset) => asset && !unavailableSerializedAssetIds.has(asset.id)
        );
      });
    }

    const assetModels = await this.assetModelService.getAll({
      lendingLocationId: loan.lendingLocationId,
      isActive: true,
    });

    return {
      loan,
      assetsByModelId,
      assetModels,
    };
  }

  async createForAdmin(lendingLocationId, payload = {}) {
    const reservedFrom = this.#parseDateInput(payload.reservedFrom);
    const reservedUntil = this.#parseDateInput(payload.reservedUntil);
    const items = this.#normalizeSelectedItems(payload.items);
    if (!reservedFrom || !reservedUntil) {
      throw new Error('Von/Bis ist erforderlich');
    }
    if (reservedUntil <= reservedFrom) {
      throw new Error('Bis muss nach Von liegen');
    }
    if (!items.length) {
      throw new Error('Mindestens ein Asset ist erforderlich');
    }

    const { userId, createdUserId } = await this.#resolveLoanUser(payload);
    try {
      return await this.loanService.createReservation({
        userId,
        lendingLocationId,
        reservedFrom,
        reservedUntil,
        notes: payload.notes || null,
        items,
        skipOpeningHours: true,
      });
    } catch (err) {
      if (createdUserId) {
        await this.models.User.destroy({ where: { id: createdUserId } });
      }
      throw err;
    }
  }

  async handOver(loanId, lendingLocationId, payload) {
    await this.getForAdmin(loanId, lendingLocationId);
    return this.loanService.handOverLoan(loanId, payload);
  }

  async returnLoan(loanId, lendingLocationId, payload) {
    await this.getForAdmin(loanId, lendingLocationId);
    return this.loanService.returnLoan(loanId, payload);
  }

  async addItems(loanId, lendingLocationId, payload) {
    await this.getForAdmin(loanId, lendingLocationId);
    return this.loanService.addLoanItems(loanId, payload);
  }

  async updatePeriod(loanId, lendingLocationId, payload) {
    await this.getForAdmin(loanId, lendingLocationId);
    return this.loanService.updateLoanPeriod(loanId, {
      ...payload,
      skipOpeningHours: true,
    });
  }

  async updateItemModel(loanId, lendingLocationId, loanItemId, assetModelId) {
    await this.getForAdmin(loanId, lendingLocationId);
    return this.loanService.updateLoanItemModel(loanId, loanItemId, assetModelId);
  }

  async returnItems(loanId, lendingLocationId, payload) {
    await this.getForAdmin(loanId, lendingLocationId);
    return this.loanService.returnLoanItems(loanId, payload);
  }

  async searchModels(lendingLocationId, query) {
    const q = String(query || '').trim();
    if (!q) {
      return [];
    }
    const models = await this.assetModelService.getAll({
      lendingLocationId,
      query: q,
      isActive: true,
    }, { limit: 12, order: [['name', 'ASC']] });
    return models.map((model) => ({
      id: model.id,
      name: model.name,
      manufacturerName: model.manufacturer ? model.manufacturer.name : '',
      categoryName: model.category ? model.category.name : '',
    }));
  }

  async searchUsers(query) {
    const q = String(query || '').trim();
    if (!q || q.length < 2) {
      return [];
    }
    const users = await this.models.User.findAll({
      where: {
        isActive: true,
        [this.models.Sequelize.Op.and]: [
          this.models.sequelize.where(
            this.models.sequelize.fn(
              'CONCAT',
              this.models.sequelize.fn(
                'LOWER',
                this.models.sequelize.fn('COALESCE', this.models.sequelize.col('first_name'), '')
              ),
              ' ',
              this.models.sequelize.fn(
                'LOWER',
                this.models.sequelize.fn('COALESCE', this.models.sequelize.col('last_name'), '')
              ),
              ' ',
              this.models.sequelize.fn(
                'LOWER',
                this.models.sequelize.fn('COALESCE', this.models.sequelize.col('username'), '')
              ),
              ' ',
              this.models.sequelize.fn(
                'LOWER',
                this.models.sequelize.fn('COALESCE', this.models.sequelize.col('email'), '')
              )
            ),
            { [this.models.Sequelize.Op.like]: `%${q.toLowerCase()}%` }
          ),
        ],
      },
      order: [['firstName', 'ASC'], ['lastName', 'ASC'], ['username', 'ASC']],
      limit: 12,
    });
    return users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      label: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username,
    }));
  }

  async searchAssets(lendingLocationId, query) {
    const q = String(query || '').trim();
    if (!q || q.length < 1) {
      return [];
    }
    const assets = await this.assetInstanceService.searchAssets(
      {
        lendingLocationId,
        query: q,
        isActive: true,
      },
      {
        limit: 20,
        order: [['inventoryNumber', 'ASC'], ['serialNumber', 'ASC']],
      }
    );
    const bulkModelIds = Array.from(
      new Set(
        assets
          .filter((asset) => asset && asset.model && asset.model.trackingType === 'bulk')
          .map((asset) => asset.assetModelId)
          .filter(Boolean)
      )
    );

    let bulkStockByModelId = new Map();
    if (bulkModelIds.length) {
      const stocks = await this.models.InventoryStock.findAll({
        where: {
          lendingLocationId,
          assetModelId: { [this.models.Sequelize.Op.in]: bulkModelIds },
        },
        attributes: ['assetModelId', 'quantityAvailable'],
      });
      bulkStockByModelId = new Map(
        stocks.map((stock) => [
          stock.assetModelId,
          Math.max(parseInt(stock.quantityAvailable, 10) || 0, 0),
        ])
      );
    }

    return assets.map((asset) => {
      const model = asset.model || null;
      const manufacturerName = model && model.manufacturer ? model.manufacturer.name : '';
      const isBulk = Boolean(model && model.trackingType === 'bulk');
      const availableQuantity = isBulk ? (bulkStockByModelId.get(asset.assetModelId) || 0) : 1;

      return {
        kind: isBulk ? 'bulk' : 'serialized',
        id: asset.id,
        assetId: isBulk ? null : asset.id,
        assetModelId: asset.assetModelId,
        inventoryNumber: asset.inventoryNumber || '',
        serialNumber: asset.serialNumber || '',
        modelId: asset.assetModelId,
        modelName: model ? model.name : '',
        manufacturerName,
        availableQuantity,
        label: [
          asset.inventoryNumber || asset.serialNumber || asset.id,
          model ? model.name : null,
          manufacturerName || null,
          isBulk ? `${availableQuantity} verfügbar` : null,
        ].filter(Boolean).join(' — '),
      };
    });
  }

  async listAssetCodes(lendingLocationId, limit = 12000) {
    const safeLimit = Math.max(100, Math.min(parseInt(limit, 10) || 12000, 30000));
    const assets = await this.models.Asset.findAll({
      where: {
        lendingLocationId,
        isActive: true,
      },
      attributes: ['inventoryNumber', 'serialNumber'],
      order: [['inventoryNumber', 'ASC'], ['serialNumber', 'ASC']],
      limit: safeLimit,
    });

    const codes = [];
    const seen = new Set();
    assets.forEach((asset) => {
      const values = [asset.inventoryNumber, asset.serialNumber];
      values.forEach((value) => {
        const text = String(value || '').trim();
        if (!text || text === '-' || seen.has(text)) {
          return;
        }
        seen.add(text);
        codes.push(text);
      });
    });
    return codes;
  }

  async removeItem(loanId, lendingLocationId, itemId) {
    await this.getForAdmin(loanId, lendingLocationId);
    return this.loanService.removeLoanItem(loanId, itemId);
  }

  async resolveLendingLocationId(loanId) {
    const loan = await this.loanService.getById(loanId);
    return loan.lendingLocationId;
  }
}

module.exports = LoanPortalService;
