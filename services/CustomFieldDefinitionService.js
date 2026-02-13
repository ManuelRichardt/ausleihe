const { Op } = require('sequelize');
const { pickDefined, buildListOptions, findByPkOrThrow, applyIncludeDeleted } = require('./_serviceUtils');

class CustomFieldDefinitionService {
  constructor(models) {
    this.models = models;
  }

  buildDefinitionWhere(filter = {}) {
    const { sequelize } = this.models;
    const where = {};
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
    if (filter.scope) {
      where.scope = filter.scope;
    }
    if (filter.assetModelId) {
      where.assetModelId = filter.assetModelId;
    }
    if (filter.lendingLocationId) {
      if (filter.includeAssetModel) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({
          [Op.or]: [
            { lendingLocationId: filter.lendingLocationId },
            { scope: 'asset_model' },
          ],
        });
      } else {
        where.lendingLocationId = filter.lendingLocationId;
      }
    }
    if (filter.query) {
      const likeValue = `%${String(filter.query).toLowerCase()}%`;
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({
        [Op.or]: [
        sequelize.where(sequelize.fn('LOWER', sequelize.col('key')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('label')), { [Op.like]: likeValue }),
        ],
      });
    }
    return where;
  }

  async create(data) {
    const { CustomFieldDefinition, AssetModel, LendingLocation, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      await this.#validateDefinitionTargets(data, transaction);
      return CustomFieldDefinition.create(
        {
          scope: data.scope || 'global',
          assetModelId: data.assetModelId || null,
          lendingLocationId: data.lendingLocationId || null,
          key: data.key,
          label: data.label,
          type: data.type,
          enumValues: data.enumValues || null,
          required: Boolean(data.required),
          defaultValue: data.defaultValue || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
        { transaction }
      );
    });
  }

  async getById(id, options = {}) {
    const findOptions = {};
    if (options.includeDeleted) {
      findOptions.paranoid = false;
    }
    return findByPkOrThrow(this.models.CustomFieldDefinition, id, 'CustomFieldDefinition not found', findOptions);
  }

  async getAll(filter = {}, options = {}) {
    const where = this.buildDefinitionWhere(filter);
    const listOptions = buildListOptions(options);
    applyIncludeDeleted(listOptions, filter);
    return this.models.CustomFieldDefinition.findAll({
      where,
      ...listOptions,
      include: [
        { model: this.models.AssetModel, as: 'assetModel' },
        { model: this.models.LendingLocation, as: 'lendingLocation' },
      ],
    });
  }

  async getByAssetModel(assetModelId, options = {}) {
    return this.models.CustomFieldDefinition.findAll({
      where: { assetModelId, isActive: true },
      ...buildListOptions(options),
    });
  }

  async getByLendingLocation(lendingLocationId, options = {}) {
    return this.models.CustomFieldDefinition.findAll({
      where: { lendingLocationId, isActive: true },
      ...buildListOptions(options),
    });
  }

  async countDefinitions(filter = {}) {
    const where = this.buildDefinitionWhere(filter);
    const countOptions = {};
    if (filter.includeDeleted) {
      countOptions.paranoid = false;
    }
    return this.models.CustomFieldDefinition.count({ where, ...countOptions });
  }

  async update(id, updates) {
    if (updates.key !== undefined) {
      throw new Error('CustomFieldDefinition key is immutable');
    }
    const definition = await this.getById(id);
    const allowed = pickDefined(updates, [
      'label',
      'type',
      'enumValues',
      'required',
      'defaultValue',
      'isActive',
    ]);
    await this.#validateDefinitionTargets({
      scope: definition.scope,
      assetModelId: definition.assetModelId,
      lendingLocationId: definition.lendingLocationId,
      type: allowed.type || definition.type,
      enumValues: allowed.enumValues !== undefined ? allowed.enumValues : definition.enumValues,
    });
    await definition.update(allowed);
    return definition;
  }

  async deactivate(id) {
    const definition = await this.getById(id);
    await definition.update({ isActive: false });
    return definition;
  }

  async delete(id) {
    const definition = await this.getById(id);
    await definition.destroy();
    return true;
  }

  async restore(id) {
    const restored = await this.models.CustomFieldDefinition.restore({ where: { id } });
    if (!restored) {
      throw new Error('CustomFieldDefinition not found');
    }
    return this.getById(id);
  }

  async resolveCustomFieldsForAssetInstance(assetInstanceId) {
    const asset = await this.models.Asset.findByPk(assetInstanceId);
    if (!asset) {
      throw new Error('Asset not found');
    }
    const [byModel, byLocation] = await Promise.all([
      this.getByAssetModel(asset.assetModelId),
      this.getByLendingLocation(asset.lendingLocationId),
    ]);
    return [...byModel, ...byLocation];
  }

  async #validateDefinitionTargets(data, transaction) {
    const { AssetModel, LendingLocation } = this.models;
    const hasAssetModel = Boolean(data.assetModelId);
    const hasLendingLocation = Boolean(data.lendingLocationId);
    if (!data.scope || data.scope === 'global') {
      if (hasAssetModel || hasLendingLocation) {
        throw new Error('Global scope must not have assetModelId or lendingLocationId');
      }
      return;
    }
    if (hasAssetModel === hasLendingLocation) {
      throw new Error('Exactly one of assetModelId or lendingLocationId must be set');
    }
    if (data.scope === 'asset_model' && !hasAssetModel) {
      throw new Error('assetModelId is required for asset_model scope');
    }
    if (data.scope === 'lending_location' && !hasLendingLocation) {
      throw new Error('lendingLocationId is required for lending_location scope');
    }
    if (data.scope === 'asset_model') {
      const model = await AssetModel.findByPk(data.assetModelId, { transaction });
      if (!model) {
        throw new Error('AssetModel not found');
      }
    }
    if (data.scope === 'lending_location') {
      const location = await LendingLocation.findByPk(data.lendingLocationId, { transaction });
      if (!location) {
        throw new Error('LendingLocation not found');
      }
    }
    if (data.type === 'enum') {
      if (!Array.isArray(data.enumValues) || data.enumValues.length === 0) {
        throw new Error('enumValues must be a non-empty array for enum type');
      }
    } else if (data.enumValues) {
      throw new Error('enumValues is only allowed for enum type');
    }
  }
}

module.exports = CustomFieldDefinitionService;
