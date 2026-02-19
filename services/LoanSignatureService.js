const { pickDefined, buildListOptions, findByPkOrThrow } = require('./serviceUtils');

class LoanSignatureService {
  constructor(models) {
    this.models = models;
  }

  async addSignature(data) {
    const { Loan, User, LoanSignature, sequelize } = this.models;
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
      return LoanSignature.create(
        {
          loanId: data.loanId,
          userId: data.userId || null,
          signatureType: data.signatureType,
          signedByName: data.signedByName,
          signedAt: data.signedAt || new Date(),
          filePath: data.filePath,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          metadata: data.metadata || null,
        },
        { transaction }
      );
    });
  }

  async deleteSignature(signatureId) {
    const signature = await findByPkOrThrow(
      this.models.LoanSignature,
      signatureId,
      'LoanSignature not found'
    );
    await signature.destroy();
    return true;
  }

  async getById(id) {
    return findByPkOrThrow(this.models.LoanSignature, id, 'LoanSignature not found');
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    if (filter.loanId) {
      where.loanId = filter.loanId;
    }
    if (filter.userId) {
      where.userId = filter.userId;
    }
    if (filter.signatureType) {
      where.signatureType = filter.signatureType;
    }
    return this.models.LoanSignature.findAll({ where, ...buildListOptions(options) });
  }

  async updateSignature(id, updates) {
    const signature = await this.getById(id);
    const allowed = pickDefined(updates, ['signatureType', 'signedByName', 'signedAt', 'filePath', 'metadata']);
    await signature.update(allowed);
    return signature;
  }
}

module.exports = LoanSignatureService;
