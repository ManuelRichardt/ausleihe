class LoanPortalService {
  constructor(models, loanService, assetModelService, assetInstanceService) {
    this.models = models;
    this.loanService = loanService;
    this.assetModelService = assetModelService;
    this.assetInstanceService = assetInstanceService;
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

  async listForUser(userId, filter = {}) {
    return this.loanService.getAll(
      {
        userId,
        status: filter.status || undefined,
      },
      {
        include: this.#includes({ includeUser: false }),
        order: [['reservedFrom', 'DESC']],
      }
    );
  }

  async listForAdmin(lendingLocationId, filter = {}) {
    if (filter.status === 'today_returns') {
      const { Op } = this.models.Sequelize;
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      return this.models.Loan.findAll({
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
    }

    if (filter.status === 'overdue') {
      const { Op } = this.models.Sequelize;
      const now = new Date();
      return this.models.Loan.findAll({
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
    }

    return this.loanService.getAll(
      {
        lendingLocationId,
        status: filter.status || undefined,
      },
      {
        include: this.#includes({ includeUser: true }),
        order: [['reservedFrom', 'DESC']],
      }
    );
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
        assetsByModelId[modelId] = groups[index] || [];
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
