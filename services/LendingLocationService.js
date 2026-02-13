const { Op } = require('sequelize');
const {
  pickDefined,
  applyIsActiveFilter,
  buildListOptions,
  findByPkOrThrow,
  applyIncludeDeleted,
} = require('./_serviceUtils');

const openingHoursInclude = { model: null, as: 'openingHours' };

class LendingLocationService {
  constructor(models) {
    this.models = models;
  }

  normalizeBoolean(value, fallback) {
    if (value === undefined) {
      return fallback;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value).toLowerCase();
    if (['true', '1', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'off'].includes(normalized)) {
      return false;
    }
    return fallback;
  }

  buildLocationWhere(filter = {}) {
    const { sequelize } = this.models;
    const where = {};
    applyIsActiveFilter(where, filter);
    if (filter.query) {
      const likeValue = `%${String(filter.query).toLowerCase()}%`;
      where[Op.or] = [
        sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('contact_email')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('description')), { [Op.like]: likeValue }),
      ];
    }
    return where;
  }

  buildCreateLocationPayload(data) {
    // Default inactive fields to null to keep schema consistent
    return {
      name: data.name,
      description: data.description || null,
      contactEmail: data.contactEmail || null,
      isActive: this.normalizeBoolean(data.isActive, true),
    };
  }

  pickLocationUpdates(updates) {
    const picked = pickDefined(updates, ['name', 'description', 'contactEmail', 'isActive']);
    if (picked.isActive !== undefined) {
      picked.isActive = this.normalizeBoolean(picked.isActive, true);
    }
    if (picked.description === '') {
      picked.description = null;
    }
    if (picked.contactEmail === '') {
      picked.contactEmail = null;
    }
    return picked;
  }

  async createLocation(data) {
    const payload = this.buildCreateLocationPayload(data);
    return this.models.LendingLocation.create(payload);
  }

  async getById(id, options = {}) {
    const findOptions = {};
    if (options.includeDeleted) {
      findOptions.paranoid = false;
    }
    return findByPkOrThrow(this.models.LendingLocation, id, 'LendingLocation not found', findOptions);
  }

  async getAll(filter = {}, options = {}) {
    const where = this.buildLocationWhere(filter);
    // Eager-load opening hours for location listings
    const listOptions = buildListOptions(options);
    applyIncludeDeleted(listOptions, filter);
    return this.models.LendingLocation.findAll({
      where,
      ...listOptions,
      include: [{ ...openingHoursInclude, model: this.models.OpeningHour }],
    });
  }

  async countLocations(filter = {}) {
    const where = this.buildLocationWhere(filter);
    const countOptions = {};
    if (filter.includeDeleted) {
      countOptions.paranoid = false;
    }
    return this.models.LendingLocation.count({ where, ...countOptions });
  }

  async updateLocation(id, updates) {
    const location = await this.getById(id);
    const allowedUpdates = this.pickLocationUpdates(updates);
    await location.update(allowedUpdates);
    return location;
  }

  async setActive(id, nextIsActive) {
    if (nextIsActive === undefined) {
      throw new Error('nextIsActive is required');
    }
    const location = await this.getById(id);
    await location.update({ isActive: Boolean(nextIsActive) });
    return location;
  }

  async deleteLocation(id) {
    const location = await this.getById(id);
    // Hard delete; consider soft delete for audit retention
    await location.destroy();
    return true;
  }

  async restoreLocation(id) {
    const restored = await this.models.LendingLocation.restore({ where: { id } });
    if (!restored) {
      throw new Error('LendingLocation not found');
    }
    return this.getById(id);
  }
}

module.exports = LendingLocationService;
