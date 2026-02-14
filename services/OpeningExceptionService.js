const { Op } = require('sequelize');
const {
  buildListOptions,
  findByPkOrThrow,
  applyIncludeDeleted,
} = require('./_serviceUtils');

class OpeningExceptionService {
  constructor(models) {
    this.models = models;
  }

  resolveDateRange(data, fallbackDate = null) {
    const from = data.dateFrom || data.date || fallbackDate;
    const to = data.dateTo || from;
    if (!from) {
      const err = new Error('Datum ist erforderlich');
      err.status = 422;
      throw err;
    }
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T00:00:00.000Z`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      const err = new Error('Datum ist ungültig');
      err.status = 422;
      throw err;
    }
    if (toDate < fromDate) {
      const err = new Error('Datum bis muss größer oder gleich Datum von sein');
      err.status = 422;
      throw err;
    }
    return {
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
    };
  }

  enumerateDates(from, to) {
    const dates = [];
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    return dates;
  }

  buildPayload(data) {
    const isClosed =
      data.isClosed === true ||
      data.isClosed === 'true' ||
      data.isClosed === 1 ||
      data.isClosed === '1';
    return {
      openTime: data.openTime || null,
      closeTime: data.closeTime || null,
      pickupOpenTime: data.pickupOpenTime || null,
      pickupCloseTime: data.pickupCloseTime || null,
      returnOpenTime: data.returnOpenTime || null,
      returnCloseTime: data.returnCloseTime || null,
      isClosed,
      reason: data.reason || null,
    };
  }

  async createException(data) {
    const { LendingLocation, OpeningException, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const location = await LendingLocation.findByPk(data.lendingLocationId, { transaction });
      if (!location) {
        throw new Error('LendingLocation not found');
      }
      const range = this.resolveDateRange(data);
      const payload = this.buildPayload(data);
      const dates = this.enumerateDates(range.from, range.to);
      let firstRecord = null;

      for (const date of dates) {
        const existing = await OpeningException.findOne({
          where: { lendingLocationId: data.lendingLocationId, date },
          transaction,
        });
        if (existing) {
          await existing.update(payload, { transaction });
          if (!firstRecord) {
            firstRecord = existing;
          }
        } else {
          const created = await OpeningException.create(
            {
              lendingLocationId: data.lendingLocationId,
              date,
              ...payload,
            },
            { transaction }
          );
          if (!firstRecord) {
            firstRecord = created;
          }
        }
      }

      return firstRecord;
    });
  }

  async getById(id, options = {}) {
    const findOptions = {};
    if (options.includeDeleted) {
      findOptions.paranoid = false;
    }
    return findByPkOrThrow(this.models.OpeningException, id, 'OpeningException not found', findOptions);
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    if (filter.lendingLocationId) {
      where.lendingLocationId = filter.lendingLocationId;
    }
    if (filter.date) {
      where.date = filter.date;
    }
    if (filter.dateFrom || filter.dateTo) {
      where.date = {};
      if (filter.dateFrom) {
        where.date[Op.gte] = filter.dateFrom;
      }
      if (filter.dateTo) {
        where.date[Op.lte] = filter.dateTo;
      }
    }
    if (filter.query) {
      const likeValue = `%${String(filter.query).toLowerCase()}%`;
      where[Op.or] = [
        this.models.sequelize.where(
          this.models.sequelize.fn('LOWER', this.models.sequelize.col('reason')),
          { [Op.like]: likeValue }
        ),
      ];
    }
    if (filter.isClosed !== undefined) {
      where.isClosed = filter.isClosed;
    }
    const listOptions = buildListOptions(options);
    applyIncludeDeleted(listOptions, filter);
    return this.models.OpeningException.findAll({ where, ...listOptions });
  }

  async countExceptions(filter = {}) {
    const where = {};
    if (filter.lendingLocationId) {
      where.lendingLocationId = filter.lendingLocationId;
    }
    if (filter.date) {
      where.date = filter.date;
    }
    if (filter.dateFrom || filter.dateTo) {
      where.date = {};
      if (filter.dateFrom) {
        where.date[Op.gte] = filter.dateFrom;
      }
      if (filter.dateTo) {
        where.date[Op.lte] = filter.dateTo;
      }
    }
    if (filter.query) {
      where[Op.or] = [
        this.models.sequelize.where(
          this.models.sequelize.fn('LOWER', this.models.sequelize.col('reason')),
          { [Op.like]: `%${String(filter.query).toLowerCase()}%` }
        ),
      ];
    }
    if (filter.isClosed !== undefined) {
      where.isClosed = filter.isClosed;
    }
    const countOptions = {};
    if (filter.includeDeleted) {
      countOptions.paranoid = false;
    }
    return this.models.OpeningException.count({ where, ...countOptions });
  }

  async updateException(id, updates) {
    const { OpeningException, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const exception = await OpeningException.findByPk(id, { transaction });
      if (!exception) {
        throw new Error('OpeningException not found');
      }
      const range = this.resolveDateRange(updates, exception.date);
      const payload = this.buildPayload({
        openTime: updates.openTime !== undefined ? updates.openTime : exception.openTime,
        closeTime: updates.closeTime !== undefined ? updates.closeTime : exception.closeTime,
        pickupOpenTime:
          updates.pickupOpenTime !== undefined ? updates.pickupOpenTime : exception.pickupOpenTime,
        pickupCloseTime:
          updates.pickupCloseTime !== undefined ? updates.pickupCloseTime : exception.pickupCloseTime,
        returnOpenTime:
          updates.returnOpenTime !== undefined ? updates.returnOpenTime : exception.returnOpenTime,
        returnCloseTime:
          updates.returnCloseTime !== undefined ? updates.returnCloseTime : exception.returnCloseTime,
        isClosed: updates.isClosed !== undefined ? updates.isClosed : exception.isClosed,
        reason: updates.reason !== undefined ? updates.reason : exception.reason,
      });
      const dates = this.enumerateDates(range.from, range.to);

      let firstRecord = null;
      for (const date of dates) {
        if (date === exception.date) {
          await exception.update({ date, ...payload }, { transaction });
          if (!firstRecord) {
            firstRecord = exception;
          }
          continue;
        }
        const existing = await OpeningException.findOne({
          where: { lendingLocationId: exception.lendingLocationId, date },
          transaction,
        });
        if (existing) {
          await existing.update(payload, { transaction });
          if (!firstRecord) {
            firstRecord = existing;
          }
        } else {
          const created = await OpeningException.create(
            {
              lendingLocationId: exception.lendingLocationId,
              date,
              ...payload,
            },
            { transaction }
          );
          if (!firstRecord) {
            firstRecord = created;
          }
        }
      }

      if (!dates.includes(exception.date)) {
        await exception.destroy({ transaction });
      }

      return firstRecord || exception;
    });
  }

  async deleteException(id) {
    const exception = await this.getById(id);
    await exception.destroy();
    return true;
  }

  async restoreException(id) {
    const restored = await this.models.OpeningException.restore({ where: { id } });
    if (!restored) {
      throw new Error('OpeningException not found');
    }
    return this.getById(id);
  }
}

module.exports = OpeningExceptionService;
