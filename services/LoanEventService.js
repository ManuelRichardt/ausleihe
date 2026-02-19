const { pickDefined, buildListOptions, findByPkOrThrow } = require('./serviceUtils');

class LoanEventService {
  constructor(models) {
    this.models = models;
  }

  async addEvent(data) {
    const { Loan, User, LoanEvent, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const loan = await Loan.findByPk(data.loanId, { transaction });
      if (!loan) {
        throw new Error('Loan not found');
      }
      if (data.userId) {
        const user = await User.findByPk(data.userId, { transaction });
        if (!user) {
          throw new Error('User not found');
        }
      }
      return LoanEvent.create(
        {
          loanId: data.loanId,
          userId: data.userId || null,
          type: data.type,
          occurredAt: data.occurredAt || new Date(),
          note: data.note || null,
        },
        { transaction }
      );
    });
  }

  async getById(id) {
    return findByPkOrThrow(this.models.LoanEvent, id, 'LoanEvent not found');
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    if (filter.loanId) {
      where.loanId = filter.loanId;
    }
    if (filter.userId) {
      where.userId = filter.userId;
    }
    if (filter.type) {
      where.type = filter.type;
    }
    return this.models.LoanEvent.findAll({ where, ...buildListOptions(options) });
  }

  async updateEvent(id, updates) {
    const event = await this.getById(id);
    const allowed = pickDefined(updates, ['type', 'occurredAt', 'note', 'userId']);
    await event.update(allowed);
    return event;
  }

  async deleteEvent(id) {
    const event = await this.getById(id);
    await event.destroy();
    return true;
  }
}

module.exports = LoanEventService;
