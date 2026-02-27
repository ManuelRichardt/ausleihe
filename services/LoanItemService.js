const { Op } = require('sequelize');
const { LOAN_STATUS, LOAN_ITEM_STATUS, LOAN_ITEM_TYPE } = require('../config/dbConstants');
const { pickDefined, buildListOptions, findByPkOrThrow } = require('./serviceUtils');

const OPEN_LOAN_ITEM_STATUSES = Object.freeze([
  LOAN_ITEM_STATUS.RESERVED,
  LOAN_ITEM_STATUS.HANDED_OVER,
]);

class LoanItemService {
  constructor(models) {
    this.models = models;
  }

  async addItemToLoan(loanId, assetId, conditionOnHandover) {
    const { Loan, LoanItem, Asset, LoanEvent, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (loan.status !== 'reserved') {
        throw new Error('Cannot add items to loan');
      }
      const asset = await Asset.findByPk(assetId, { transaction });
      if (!asset) {
        throw new Error('Asset not found');
      }
      if (asset.lendingLocationId !== loan.lendingLocationId) {
        throw new Error('Asset does not belong to lending location');
      }
      const existingOpenAssignment = await LoanItem.findOne({
        where: {
          assetId,
          status: { [Op.in]: OPEN_LOAN_ITEM_STATUSES },
        },
        include: [
          {
            model: Loan,
            as: 'loan',
            where: {
              [Op.or]: [
                { status: { [Op.in]: [LOAN_STATUS.HANDED_OVER, LOAN_STATUS.OVERDUE] } },
                {
                  status: LOAN_STATUS.RESERVED,
                  reservedFrom: { [Op.lt]: loan.reservedUntil },
                  reservedUntil: { [Op.gt]: loan.reservedFrom },
                },
              ],
            },
            required: true,
          },
        ],
        transaction,
      });
      if (existingOpenAssignment) {
        throw new Error('Asset ist im gewählten Zeitraum bereits ausgeliehen oder reserviert');
      }
      const item = await LoanItem.create(
        {
          loanId,
          assetId,
          assetModelId: asset.assetModelId,
          quantity: 1,
          itemType: LOAN_ITEM_TYPE.SERIALIZED,
          status: LOAN_ITEM_STATUS.RESERVED,
          conditionOnHandover: conditionOnHandover || null,
        },
        { transaction }
      );
      await LoanEvent.create(
        {
          loanId,
          userId: null,
          type: 'item_added',
          note: null,
        },
        { transaction }
      );
      return item;
    });
  }

  async removeItemFromLoan(loanItemId) {
    const { LoanItem, Loan, LoanEvent, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const item = await LoanItem.findByPk(loanItemId, { transaction });
      if (!item) {
        throw new Error('LoanItem not found');
      }
      const loan = await Loan.findByPk(item.loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (loan.status !== 'reserved') {
        throw new Error('Cannot remove items from loan');
      }
      await item.destroy({ transaction });
      await LoanEvent.create(
        {
          loanId: loan.id,
          userId: null,
          type: 'item_removed',
          note: null,
        },
        { transaction }
      );
      return true;
    });
  }

  async deleteLoanItem(loanItemId) {
    const item = await findByPkOrThrow(this.models.LoanItem, loanItemId, 'LoanItem not found');
    await item.destroy();
    return true;
  }

  async getById(id) {
    return findByPkOrThrow(this.models.LoanItem, id, 'LoanItem not found');
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    if (filter.loanId) {
      where.loanId = filter.loanId;
    }
    if (filter.assetId) {
      where.assetId = filter.assetId;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    return this.models.LoanItem.findAll({ where, ...buildListOptions(options) });
  }

  async updateLoanItem(id, updates) {
    const item = await this.getById(id);
    const allowed = pickDefined(updates, [
      'status',
      'conditionOnHandover',
      'conditionOnReturn',
      'handedOverAt',
      'returnedAt',
    ]);
    await item.update(allowed);
    return item;
  }
}

module.exports = LoanItemService;
