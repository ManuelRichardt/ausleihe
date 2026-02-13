const { Op } = require('sequelize');
const {
  pickDefined,
  applyIsActiveFilter,
  applyLendingLocationFilter,
  buildListOptions,
  findByPkOrThrow,
  applyIncludeDeleted,
} = require('./_serviceUtils');

class ManufacturerService {
  constructor(models) {
    this.models = models;
  }

  buildCreateManufacturerPayload(data) {
    return {
      lendingLocationId: data.lendingLocationId,
      name: data.name,
      website: data.website || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };
  }

  pickManufacturerUpdates(updates) {
    return pickDefined(updates, ['name', 'website', 'isActive', 'lendingLocationId']);
  }

  async createManufacturer(data) {
    const location = await this.models.LendingLocation.findByPk(data.lendingLocationId);
    if (!location) {
      throw new Error('LendingLocation not found');
    }
    const payload = this.buildCreateManufacturerPayload(data);
    return this.models.Manufacturer.create(payload);
  }

  async getById(id, options = {}) {
    const findOptions = {
      include: [{ model: this.models.LendingLocation, as: 'lendingLocation' }],
    };
    if (options.includeDeleted) {
      findOptions.paranoid = false;
    }
    return findByPkOrThrow(this.models.Manufacturer, id, 'Manufacturer not found', findOptions);
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    applyLendingLocationFilter(where, filter);
    applyIsActiveFilter(where, filter);
    if (filter.query) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        this.models.sequelize.where(
          this.models.sequelize.fn('LOWER', this.models.sequelize.col('name')),
          { [Op.like]: `%${String(filter.query).toLowerCase()}%` }
        )
      );
    }
    const listOptions = buildListOptions(options);
    applyIncludeDeleted(listOptions, filter);
    return this.models.Manufacturer.findAll({ where, ...listOptions });
  }

  async countManufacturers(filter = {}) {
    const where = {};
    applyLendingLocationFilter(where, filter);
    applyIsActiveFilter(where, filter);
    if (filter.query) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        this.models.sequelize.where(
          this.models.sequelize.fn('LOWER', this.models.sequelize.col('name')),
          { [Op.like]: `%${String(filter.query).toLowerCase()}%` }
        )
      );
    }
    const countOptions = {};
    if (filter.includeDeleted) {
      countOptions.paranoid = false;
    }
    return this.models.Manufacturer.count({ where, ...countOptions });
  }

  async updateManufacturer(id, updates) {
    const manufacturer = await this.getById(id);
    const allowedUpdates = this.pickManufacturerUpdates(updates);
    if (allowedUpdates.lendingLocationId && allowedUpdates.lendingLocationId !== manufacturer.lendingLocationId) {
      throw new Error('LendingLocation cannot be changed');
    }
    await manufacturer.update(allowedUpdates);
    return manufacturer;
  }

  async deleteManufacturer(id) {
    const manufacturer = await this.getById(id);
    await manufacturer.destroy();
    return true;
  }

  async restoreManufacturer(id) {
    const restored = await this.models.Manufacturer.restore({ where: { id } });
    if (!restored) {
      throw new Error('Manufacturer not found');
    }
    return this.getById(id);
  }
}

module.exports = ManufacturerService;
