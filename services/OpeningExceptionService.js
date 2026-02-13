const { pickDefined, buildListOptions, findByPkOrThrow } = require('./_serviceUtils');

class OpeningExceptionService {
  constructor(models) {
    this.models = models;
  }

  async createException(data) {
    const { LendingLocation, OpeningException, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const location = await LendingLocation.findByPk(data.lendingLocationId, { transaction });
      if (!location) {
        throw new Error('LendingLocation not found');
      }
      return OpeningException.create(
        {
          lendingLocationId: data.lendingLocationId,
          date: data.date,
          openTime: data.openTime || null,
          closeTime: data.closeTime || null,
          pickupOpenTime: data.pickupOpenTime || null,
          pickupCloseTime: data.pickupCloseTime || null,
          returnOpenTime: data.returnOpenTime || null,
          returnCloseTime: data.returnCloseTime || null,
          isClosed: Boolean(data.isClosed),
          reason: data.reason || null,
        },
        { transaction }
      );
    });
  }

  async getById(id) {
    return findByPkOrThrow(this.models.OpeningException, id, 'OpeningException not found');
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    if (filter.lendingLocationId) {
      where.lendingLocationId = filter.lendingLocationId;
    }
    if (filter.date) {
      where.date = filter.date;
    }
    return this.models.OpeningException.findAll({ where, ...buildListOptions(options) });
  }

  async updateException(id, updates) {
    const exception = await this.getById(id);
    const allowed = pickDefined(updates, [
      'date',
      'openTime',
      'closeTime',
      'pickupOpenTime',
      'pickupCloseTime',
      'returnOpenTime',
      'returnCloseTime',
      'isClosed',
      'reason',
    ]);
    await exception.update(allowed);
    return exception;
  }

  async deleteException(id) {
    const exception = await this.getById(id);
    await exception.destroy();
    return true;
  }
}

module.exports = OpeningExceptionService;
