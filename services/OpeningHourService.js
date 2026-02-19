const {
  buildListOptions,
  applyLendingLocationFilter,
  findByPkOrThrow,
  pickDefined,
  applyIncludeDeleted,
} = require('./serviceUtils');

class OpeningHourService {
  constructor(models) {
    this.models = models;
  }

  normalizeNullableField(value) {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const text = String(value).trim();
    if (!text) {
      return null;
    }
    return text;
  }

  normalizeTimeField(value) {
    const normalized = this.normalizeNullableField(value);
    if (normalized === undefined || normalized === null) {
      return normalized;
    }
    const match = String(normalized).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) {
      return normalized;
    }
    const hh = String(Number(match[1])).padStart(2, '0');
    const mm = match[2];
    const ss = match[3] || '00';
    return `${hh}:${mm}:${ss}`;
  }

  buildCreatePayload(data) {
    return {
      lendingLocationId: data.lendingLocationId,
      dayOfWeek: data.dayOfWeek,
      openTime: this.normalizeTimeField(data.openTime) || null,
      closeTime: this.normalizeTimeField(data.closeTime) || null,
      pickupOpenTime: this.normalizeTimeField(data.pickupOpenTime) || null,
      pickupCloseTime: this.normalizeTimeField(data.pickupCloseTime) || null,
      returnOpenTime: this.normalizeTimeField(data.returnOpenTime) || null,
      returnCloseTime: this.normalizeTimeField(data.returnCloseTime) || null,
      isClosed: Boolean(data.isClosed),
      validFrom: this.normalizeNullableField(data.validFrom) || null,
      validTo: this.normalizeNullableField(data.validTo) || null,
      isSpecial: Boolean(data.isSpecial),
    };
  }

  pickUpdates(updates) {
    const picked = pickDefined(updates, [
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
    if (Object.prototype.hasOwnProperty.call(picked, 'openTime')) {
      picked.openTime = this.normalizeTimeField(picked.openTime);
    }
    if (Object.prototype.hasOwnProperty.call(picked, 'closeTime')) {
      picked.closeTime = this.normalizeTimeField(picked.closeTime);
    }
    if (Object.prototype.hasOwnProperty.call(picked, 'pickupOpenTime')) {
      picked.pickupOpenTime = this.normalizeTimeField(picked.pickupOpenTime);
    }
    if (Object.prototype.hasOwnProperty.call(picked, 'pickupCloseTime')) {
      picked.pickupCloseTime = this.normalizeTimeField(picked.pickupCloseTime);
    }
    if (Object.prototype.hasOwnProperty.call(picked, 'returnOpenTime')) {
      picked.returnOpenTime = this.normalizeTimeField(picked.returnOpenTime);
    }
    if (Object.prototype.hasOwnProperty.call(picked, 'returnCloseTime')) {
      picked.returnCloseTime = this.normalizeTimeField(picked.returnCloseTime);
    }
    if (Object.prototype.hasOwnProperty.call(picked, 'validFrom')) {
      picked.validFrom = this.normalizeNullableField(picked.validFrom);
    }
    if (Object.prototype.hasOwnProperty.call(picked, 'validTo')) {
      picked.validTo = this.normalizeNullableField(picked.validTo);
    }
    return picked;
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
        openTime: this.normalizeTimeField(data.openTime) || null,
        closeTime: this.normalizeTimeField(data.closeTime) || null,
        pickupOpenTime: this.normalizeTimeField(data.pickupOpenTime) || null,
        pickupCloseTime: this.normalizeTimeField(data.pickupCloseTime) || null,
        returnOpenTime: this.normalizeTimeField(data.returnOpenTime) || null,
        returnCloseTime: this.normalizeTimeField(data.returnCloseTime) || null,
        isClosed: Boolean(data.isClosed),
        validFrom: this.normalizeNullableField(data.validFrom) || null,
        validTo: this.normalizeNullableField(data.validTo) || null,
      });
      return existing;
    }

    return OpeningHour.create({
      lendingLocationId: data.lendingLocationId,
      dayOfWeek: data.dayOfWeek,
      openTime: this.normalizeTimeField(data.openTime) || null,
      closeTime: this.normalizeTimeField(data.closeTime) || null,
      pickupOpenTime: this.normalizeTimeField(data.pickupOpenTime) || null,
      pickupCloseTime: this.normalizeTimeField(data.pickupCloseTime) || null,
      returnOpenTime: this.normalizeTimeField(data.returnOpenTime) || null,
      returnCloseTime: this.normalizeTimeField(data.returnCloseTime) || null,
      isClosed: Boolean(data.isClosed),
      validFrom: this.normalizeNullableField(data.validFrom) || null,
      validTo: this.normalizeNullableField(data.validTo) || null,
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
    const from = data.dateFrom || data.date;
    const to = data.dateTo || from;
    if (!from) {
      throw new Error('date is required');
    }
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      throw new Error('Invalid date range');
    }

    const payload = {
      openTime: data.openTime || null,
      closeTime: data.closeTime || null,
      pickupOpenTime: data.pickupOpenTime || null,
      pickupCloseTime: data.pickupCloseTime || null,
      returnOpenTime: data.returnOpenTime || null,
      returnCloseTime: data.returnCloseTime || null,
      isClosed:
        data.isClosed === true ||
        data.isClosed === 'true' ||
        data.isClosed === 1 ||
        data.isClosed === '1',
      reason: data.reason || null,
    };

    let firstRecord = null;
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      const existing = await OpeningException.findOne({
        where: {
          lendingLocationId: data.lendingLocationId,
          date,
        },
      });
      if (existing) {
        await existing.update(payload);
        if (!firstRecord) {
          firstRecord = existing;
        }
      } else {
        const created = await OpeningException.create({
          lendingLocationId: data.lendingLocationId,
          date,
          ...payload,
        });
        if (!firstRecord) {
          firstRecord = created;
        }
      }
    }

    return firstRecord;
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
