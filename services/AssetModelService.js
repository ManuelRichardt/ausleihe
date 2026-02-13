const { Op } = require('sequelize');
const {
  pickDefined,
  applyIsActiveFilter,
  applyLendingLocationFilter,
  buildListOptions,
  findByPkOrThrow,
  applyIncludeDeleted,
} = require('./_serviceUtils');

class AssetModelService {
  constructor(models) {
    this.models = models;
  }

  buildCreateAssetModelPayload(data) {
    return {
      lendingLocationId: data.lendingLocationId,
      manufacturerId: data.manufacturerId,
      categoryId: data.categoryId,
      name: data.name,
      description: data.description || null,
      technicalDescription: data.technicalDescription || null,
      imageUrl: data.imageUrl || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };
  }

  pickAssetModelUpdates(updates) {
    return pickDefined(updates, [
      'lendingLocationId',
      'manufacturerId',
      'categoryId',
      'name',
      'description',
      'technicalDescription',
      'imageUrl',
      'isActive',
    ]);
  }

  async createAssetModel(data) {
    const { Manufacturer, AssetCategory, AssetModel, LendingLocation, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const location = await LendingLocation.findByPk(data.lendingLocationId, { transaction });
      if (!location) {
        throw new Error('LendingLocation not found');
      }
      const manufacturer = await Manufacturer.findByPk(data.manufacturerId, { transaction });
      if (!manufacturer) {
        throw new Error('Manufacturer not found');
      }
      const category = await AssetCategory.findByPk(data.categoryId, { transaction });
      if (!category) {
        throw new Error('AssetCategory not found');
      }
      if (manufacturer.lendingLocationId !== data.lendingLocationId) {
        throw new Error('Manufacturer does not belong to lending location');
      }
      if (category.lendingLocationId !== data.lendingLocationId) {
        throw new Error('AssetCategory does not belong to lending location');
      }
      const payload = this.buildCreateAssetModelPayload(data);
      return AssetModel.create(payload, { transaction });
    });
  }

  async getById(id, options = {}) {
    const findOptions = {
      include: [
        { model: this.models.Manufacturer, as: 'manufacturer' },
        { model: this.models.AssetCategory, as: 'category' },
        { model: this.models.LendingLocation, as: 'lendingLocation' },
        { model: this.models.AssetAttachment, as: 'attachments' },
      ],
    };
    if (options.includeDeleted) {
      findOptions.paranoid = false;
    }
    return findByPkOrThrow(this.models.AssetModel, id, 'AssetModel not found', findOptions);
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    applyLendingLocationFilter(where, filter);
    if (filter.manufacturerId) {
      where.manufacturerId = filter.manufacturerId;
    }
    if (filter.categoryId) {
      where.categoryId = filter.categoryId;
    }
    if (filter.query) {
      const likeValue = `%${String(filter.query).toLowerCase()}%`;
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({
        [Op.or]: [
          this.models.sequelize.where(this.models.sequelize.fn('LOWER', this.models.sequelize.col('name')), { [Op.like]: likeValue }),
          this.models.sequelize.where(this.models.sequelize.fn('LOWER', this.models.sequelize.col('description')), { [Op.like]: likeValue }),
          this.models.sequelize.where(this.models.sequelize.fn('LOWER', this.models.sequelize.col('technical_description')), { [Op.like]: likeValue }),
        ],
      });
    }
    applyIsActiveFilter(where, filter);
    const listOptions = buildListOptions(options);
    applyIncludeDeleted(listOptions, filter);
    return this.models.AssetModel.findAll({
      where,
      include: [
        { model: this.models.Manufacturer, as: 'manufacturer' },
        { model: this.models.AssetCategory, as: 'category' },
        { model: this.models.LendingLocation, as: 'lendingLocation' },
        { model: this.models.AssetAttachment, as: 'attachments' },
      ],
      ...listOptions,
    });
  }

  async getByIds(ids) {
    if (!Array.isArray(ids) || !ids.length) {
      return [];
    }
    return this.models.AssetModel.findAll({
      where: { id: ids },
      include: [
        { model: this.models.Manufacturer, as: 'manufacturer' },
        { model: this.models.AssetCategory, as: 'category' },
        { model: this.models.LendingLocation, as: 'lendingLocation' },
        { model: this.models.AssetAttachment, as: 'attachments' },
      ],
    });
  }

  async countAssetModels(filter = {}) {
    const where = {};
    applyLendingLocationFilter(where, filter);
    if (filter.manufacturerId) {
      where.manufacturerId = filter.manufacturerId;
    }
    if (filter.categoryId) {
      where.categoryId = filter.categoryId;
    }
    if (filter.query) {
      const likeValue = `%${String(filter.query).toLowerCase()}%`;
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({
        [Op.or]: [
          this.models.sequelize.where(this.models.sequelize.fn('LOWER', this.models.sequelize.col('name')), { [Op.like]: likeValue }),
          this.models.sequelize.where(this.models.sequelize.fn('LOWER', this.models.sequelize.col('description')), { [Op.like]: likeValue }),
          this.models.sequelize.where(this.models.sequelize.fn('LOWER', this.models.sequelize.col('technical_description')), { [Op.like]: likeValue }),
        ],
      });
    }
    applyIsActiveFilter(where, filter);
    const countOptions = {};
    if (filter.includeDeleted) {
      countOptions.paranoid = false;
    }
    return this.models.AssetModel.count({ where, ...countOptions });
  }

  async updateAssetModel(id, updates) {
    const assetModel = await this.getById(id);
    const allowedUpdates = this.pickAssetModelUpdates(updates);
    if (allowedUpdates.lendingLocationId && allowedUpdates.lendingLocationId !== assetModel.lendingLocationId) {
      throw new Error('LendingLocation cannot be changed');
    }
    await assetModel.update(allowedUpdates);
    return assetModel;
  }

  async deleteAssetModel(id) {
    const assetModel = await this.getById(id);
    await assetModel.destroy();
    return true;
  }

  async restoreAssetModel(id) {
    const restored = await this.models.AssetModel.restore({ where: { id } });
    if (!restored) {
      throw new Error('AssetModel not found');
    }
    return this.getById(id);
  }
}

module.exports = AssetModelService;
