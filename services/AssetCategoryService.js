const { Op } = require('sequelize');
const {
  pickDefined,
  applyIsActiveFilter,
  applyLendingLocationFilter,
  buildListOptions,
  findByPkOrThrow,
  applyIncludeDeleted,
} = require('./_serviceUtils');

class AssetCategoryService {
  constructor(models) {
    this.models = models;
  }

  buildCreateCategoryPayload(data) {
    return {
      lendingLocationId: data.lendingLocationId,
      name: data.name,
      description: data.description || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };
  }

  pickCategoryUpdates(updates) {
    return pickDefined(updates, ['name', 'description', 'isActive', 'lendingLocationId']);
  }

  async createCategory(data) {
    const location = await this.models.LendingLocation.findByPk(data.lendingLocationId);
    if (!location) {
      throw new Error('LendingLocation not found');
    }
    const payload = this.buildCreateCategoryPayload(data);
    return this.models.AssetCategory.create(payload);
  }

  async getById(id, options = {}) {
    const findOptions = {
      include: [{ model: this.models.LendingLocation, as: 'lendingLocation' }],
    };
    if (options.includeDeleted) {
      findOptions.paranoid = false;
    }
    return findByPkOrThrow(this.models.AssetCategory, id, 'AssetCategory not found', findOptions);
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
    return this.models.AssetCategory.findAll({ where, ...listOptions });
  }

  async countCategories(filter = {}) {
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
    return this.models.AssetCategory.count({ where, ...countOptions });
  }

  async updateCategory(id, updates) {
    const category = await this.getById(id);
    const allowedUpdates = this.pickCategoryUpdates(updates);
    if (allowedUpdates.lendingLocationId && allowedUpdates.lendingLocationId !== category.lendingLocationId) {
      throw new Error('LendingLocation cannot be changed');
    }
    await category.update(allowedUpdates);
    return category;
  }

  async setActive(id, nextIsActive) {
    if (nextIsActive === undefined) {
      throw new Error('nextIsActive is required');
    }
    const category = await this.getById(id);
    await category.update({ isActive: Boolean(nextIsActive) });
    return category;
  }

  async deleteCategory(id) {
    const category = await this.getById(id);
    await category.destroy();
    return true;
  }

  async restoreCategory(id) {
    const restored = await this.models.AssetCategory.restore({ where: { id } });
    if (!restored) {
      throw new Error('AssetCategory not found');
    }
    return this.getById(id);
  }
}

module.exports = AssetCategoryService;
