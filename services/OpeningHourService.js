const {
  buildListOptions,
  applyLendingLocationFilter,
  findByPkOrThrow,
  pickDefined,
  applyIncludeDeleted,
} = require('./_serviceUtils');

class OpeningHourService {
  constructor(models) {
    this.models = models;
  }

  buildCreatePayload(data) {
    return {
      lendingLocationId: data.lendingLocationId,
      dayOfWeek: data.dayOfWeek,
      openTime: data.openTime || null,
      closeTime: data.closeTime || null,
      pickupOpenTime: data.pickupOpenTime || null,
      pickupCloseTime: data.pickupCloseTime || null,
      returnOpenTime: data.returnOpenTime || null,
      returnCloseTime: data.returnCloseTime || null,
      isClosed: Boolean(data.isClosed),
      validFrom: data.validFrom || null,
      validTo: data.validTo || null,
      isSpecial: Boolean(data.isSpecial),
    };
  }

  pickUpdates(updates) {
    return pickDefined(updates, [
      'dayOfWeek',
      'openTime',
      'closeTime',
      'pickupOpenTime',
      'pickupCloseTime',
      'returnOpenTime',
      'returnCloseTime',
      'isClosed',
      'validFrom',
      'validTo',
      'isSpecial',
    ]);
  }

  async createOpeningHour(data) {
    const location = await this.models.LendingLocation.findByPk(data.lendingLocationId);
    if (!location) {
      throw new Error('LendingLocation not found');
    }
    return this.models.OpeningHour.create(this.buildCreatePayload(data));
  }

  async getById(id, options = {}) {
    const findOptions = {};
    if (options.includeDeleted) {
      findOptions.paranoid = false;
    }
    return findByPkOrThrow(this.models.OpeningHour, id, 'OpeningHour not found', findOptions);
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    applyLendingLocationFilter(where, filter, true);
    if (filter.isSpecial !== undefined) {
      where.isSpecial = filter.isSpecial;
    }
    if (filter.dayOfWeek) {
      where.dayOfWeek = filter.dayOfWeek;
    }
    if (filter.isClosed !== undefined) {
      where.isClosed = filter.isClosed;
    }
    const listOptions = buildListOptions(options);
    applyIncludeDeleted(listOptions, filter);
    return this.models.OpeningHour.findAll({ where, ...listOptions });
  }

  async countOpeningHours(filter = {}) {
    const where = {};
    applyLendingLocationFilter(where, filter, true);
    if (filter.isSpecial !== undefined) {
      where.isSpecial = filter.isSpecial;
    }
    if (filter.dayOfWeek) {
      where.dayOfWeek = filter.dayOfWeek;
    }
    if (filter.isClosed !== undefined) {
      where.isClosed = filter.isClosed;
    }
    const countOptions = {};
    if (filter.includeDeleted) {
      countOptions.paranoid = false;
    }
    return this.models.OpeningHour.count({ where, ...countOptions });
  }

  async updateOpeningHour(id, updates) {
    const record = await this.getById(id);
    const allowed = this.pickUpdates(updates);
    await record.update(allowed);
    return record;
  }

  async deleteOpeningHour(id) {
    const record = await this.getById(id);
    await record.destroy();
    return true;
  }

  async restoreOpeningHour(id) {
    const restored = await this.models.OpeningHour.restore({ where: { id } });
    if (!restored) {
      throw new Error('OpeningHour not found');
    }
    return this.getById(id);
  }

  async setRegularHours(data) {
    const { OpeningHour } = this.models;
    const existing = await OpeningHour.findOne({
      where: {
        lendingLocationId: data.lendingLocationId,
        dayOfWeek: data.dayOfWeek,
        isSpecial: false,
      },
    });

    if (existing) {
      await existing.update({
        openTime: data.openTime || null,
        closeTime: data.closeTime || null,
        pickupOpenTime: data.pickupOpenTime || null,
        pickupCloseTime: data.pickupCloseTime || null,
        returnOpenTime: data.returnOpenTime || null,
        returnCloseTime: data.returnCloseTime || null,
        isClosed: Boolean(data.isClosed),
        validFrom: data.validFrom || null,
        validTo: data.validTo || null,
      });
      return existing;
    }

    return OpeningHour.create({
      lendingLocationId: data.lendingLocationId,
      dayOfWeek: data.dayOfWeek,
      openTime: data.openTime || null,
      closeTime: data.closeTime || null,
      pickupOpenTime: data.pickupOpenTime || null,
      pickupCloseTime: data.pickupCloseTime || null,
      returnOpenTime: data.returnOpenTime || null,
      returnCloseTime: data.returnCloseTime || null,
      isClosed: Boolean(data.isClosed),
      validFrom: data.validFrom || null,
      validTo: data.validTo || null,
      isSpecial: false,
    });
  }

  async getAllRegularHours(lendingLocationId, options = {}) {
    return this.models.OpeningHour.findAll({
      where: { lendingLocationId, isSpecial: false },
      ...buildListOptions(options),
    });
  }

  async setException(data) {
    const { OpeningException } = this.models;
    const existing = await OpeningException.findOne({
      where: {
        lendingLocationId: data.lendingLocationId,
        date: data.date,
      },
    });

    if (existing) {
      await existing.update({
        openTime: data.openTime || null,
        closeTime: data.closeTime || null,
        pickupOpenTime: data.pickupOpenTime || null,
        pickupCloseTime: data.pickupCloseTime || null,
        returnOpenTime: data.returnOpenTime || null,
        returnCloseTime: data.returnCloseTime || null,
        isClosed: Boolean(data.isClosed),
        reason: data.reason || null,
      });
      return existing;
    }

    return OpeningException.create({
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
    });
  }

  async getAllExceptions(lendingLocationId, options = {}) {
    return this.models.OpeningException.findAll({
      where: { lendingLocationId },
      ...buildListOptions(options),
    });
  }

  async deleteRegularHours(lendingLocationId, dayOfWeek) {
    const deleted = await this.models.OpeningHour.destroy({
      where: { lendingLocationId, dayOfWeek, isSpecial: false },
    });
    if (!deleted) {
      throw new Error('OpeningHour not found');
    }
    return true;
  }

  async deleteException(lendingLocationId, date) {
    const deleted = await this.models.OpeningException.destroy({
      where: { lendingLocationId, date },
    });
    if (!deleted) {
      throw new Error('OpeningException not found');
    }
    return true;
  }
}

module.exports = OpeningHourService;
