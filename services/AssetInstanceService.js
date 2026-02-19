const { Op } = require('sequelize');
const {
  pickDefined,
  applyIsActiveFilter,
  buildListOptions,
  findByPkOrThrow,
  applyIncludeDeleted,
} = require('./_serviceUtils');

class AssetInstanceService {
  constructor(models) {
    this.models = models;
  }

  async createAsset(data) {
    const {
      LendingLocation,
      AssetModel,
      StorageLocation,
      Asset,
      CustomFieldDefinition,
      CustomFieldValue,
      sequelize,
    } = this.models;
    return sequelize.transaction(async (transaction) => {
      const location = await LendingLocation.findByPk(data.lendingLocationId, { transaction });
      if (!location) {
        throw new Error('LendingLocation not found');
      }
      const model = await AssetModel.findByPk(data.assetModelId, { transaction });
      if (!model) {
        throw new Error('AssetModel not found');
      }
      if (model.lendingLocationId !== data.lendingLocationId) {
        throw new Error('AssetModel does not belong to lending location');
      }
      if (data.storageLocationId) {
        const storage = await StorageLocation.findByPk(data.storageLocationId, { transaction });
        if (!storage) {
          throw new Error('StorageLocation not found');
        }
        if (storage.lendingLocationId !== data.lendingLocationId) {
          throw new Error('StorageLocation does not belong to lending location');
        }
      }
      const asset = await Asset.create(
        {
          lendingLocationId: data.lendingLocationId,
          assetModelId: data.assetModelId,
          storageLocationId: data.storageLocationId || null,
          inventoryNumber: data.inventoryNumber || null,
          serialNumber: data.serialNumber || null,
          condition: data.condition || 'good',
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
        { transaction }
      );
      if (Array.isArray(data.customFieldValues) && data.customFieldValues.length > 0) {
        await this.#setCustomFieldValues(asset, data.customFieldValues, {
          CustomFieldDefinition,
          CustomFieldValue,
          transaction,
        });
      }
      return asset;
    });
  }

  async getById(id, options = {}) {
    const findOptions = {
      include: [
        {
          model: this.models.AssetModel,
          as: 'model',
          include: [
            { model: this.models.Manufacturer, as: 'manufacturer' },
            { model: this.models.AssetCategory, as: 'category' },
          ],
        },
        { model: this.models.LendingLocation, as: 'lendingLocation' },
        { model: this.models.StorageLocation, as: 'storageLocation' },
        { model: this.models.AssetAttachment, as: 'attachments' },
        {
          model: this.models.AssetMaintenance,
          as: 'maintenances',
          required: false,
          separate: true,
          order: [['reportedAt', 'DESC'], ['createdAt', 'DESC']],
        },
        {
          model: this.models.CustomFieldValue,
          as: 'customFieldValues',
          include: [{ model: this.models.CustomFieldDefinition, as: 'definition' }],
        },
      ],
    };
    if (options.includeDeleted) {
      findOptions.paranoid = false;
    }
    return findByPkOrThrow(this.models.Asset, id, 'Asset not found', findOptions);
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    applyIsActiveFilter(where, filter);
    if (filter.lendingLocationId) {
      where.lendingLocationId = filter.lendingLocationId;
    }
    if (filter.assetModelId) {
      where.assetModelId = filter.assetModelId;
    }
    if (filter.storageLocationId) {
      where.storageLocationId = filter.storageLocationId;
    }
    const listOptions = buildListOptions(options);
    applyIncludeDeleted(listOptions, filter);
    return this.models.Asset.findAll({
      where,
      include: [
        {
          model: this.models.AssetModel,
          as: 'model',
          include: [{ model: this.models.Manufacturer, as: 'manufacturer' }],
        },
        { model: this.models.LendingLocation, as: 'lendingLocation' },
        { model: this.models.StorageLocation, as: 'storageLocation' },
      ],
      ...listOptions,
    });
  }

  async countAssets(filter = {}) {
    const where = {};
    applyIsActiveFilter(where, filter);
    if (filter.lendingLocationId) {
      where.lendingLocationId = filter.lendingLocationId;
    }
    if (filter.assetModelId) {
      where.assetModelId = filter.assetModelId;
    }
    if (filter.storageLocationId) {
      where.storageLocationId = filter.storageLocationId;
    }
    const countOptions = {};
    if (filter.includeDeleted) {
      countOptions.paranoid = false;
    }
    return this.models.Asset.count({ where, ...countOptions });
  }

  async searchAssets(filter = {}, options = {}) {
    const { Asset } = this.models;
    const { where, include, paranoid } = this.buildSearchQuery(filter);
    const listOptions = buildListOptions(options);
    if (paranoid === false) {
      listOptions.paranoid = false;
    }
    return Asset.findAll({ where, include, ...listOptions });
  }

  async countSearchAssets(filter = {}) {
    const { Asset } = this.models;
    const { where, include, paranoid } = this.buildSearchQuery(filter);
    const countOptions = { distinct: true };
    if (paranoid === false) {
      countOptions.paranoid = false;
    }
    return Asset.count({ where, include, ...countOptions });
  }

  buildBaseSearchWhere(filter = {}) {
    const where = {};
    if (filter.lendingLocationId) {
      where.lendingLocationId = filter.lendingLocationId;
    }
    if (filter.assetModelId) {
      where.assetModelId = filter.assetModelId;
    }
    if (filter.storageLocationId) {
      where.storageLocationId = filter.storageLocationId;
    }
    applyIsActiveFilter(where, filter);
    return where;
  }

  buildSearchInclude(filter = {}) {
    const include = [
      {
        model: this.models.AssetModel,
        as: 'model',
        include: [
          { model: this.models.Manufacturer, as: 'manufacturer' },
          { model: this.models.AssetCategory, as: 'category' },
        ],
      },
      { model: this.models.LendingLocation, as: 'lendingLocation' },
      { model: this.models.StorageLocation, as: 'storageLocation' },
    ];
    if (filter.categoryId) {
      include[0].where = include[0].where || {};
      include[0].where.categoryId = filter.categoryId;
    }
    if (filter.manufacturerId) {
      include[0].include[0].where = { id: filter.manufacturerId };
      include[0].include[0].required = true;
    }
    return include;
  }

  buildSearchPredicates(filter = {}) {
    const { sequelize } = this.models;
    const searchPredicates = [];
    if (filter.query) {
      const likeValue = `%${String(filter.query).toLowerCase()}%`;
      // sequelize.col uses raw DB snake_case column names here.
      searchPredicates.push(
        sequelize.where(sequelize.fn('LOWER', sequelize.col('inventory_number')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('serial_number')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('model.name')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('model.description')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('model.technical_description')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('model.manufacturer.name')), { [Op.like]: likeValue })
      );
      return searchPredicates;
    }

    if (filter.name) {
      searchPredicates.push(
        sequelize.where(sequelize.fn('LOWER', sequelize.col('model.name')), {
          [Op.like]: `%${String(filter.name).toLowerCase()}%`,
        })
      );
    }
    if (filter.description) {
      const likeValue = `%${String(filter.description).toLowerCase()}%`;
      searchPredicates.push(
        sequelize.where(sequelize.fn('LOWER', sequelize.col('model.description')), { [Op.like]: likeValue }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('model.technical_description')), { [Op.like]: likeValue })
      );
    }
    if (filter.manufacturer) {
      searchPredicates.push(
        sequelize.where(sequelize.fn('LOWER', sequelize.col('model.manufacturer.name')), {
          [Op.like]: `%${String(filter.manufacturer).toLowerCase()}%`,
        })
      );
    }
    return searchPredicates;
  }

  buildSearchQuery(filter = {}) {
    const where = this.buildBaseSearchWhere(filter);
    const include = this.buildSearchInclude(filter);
    const { sequelize } = this.models;
    const searchPredicates = this.buildSearchPredicates(filter);

    if (filter.inventoryNumber && !filter.query) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(sequelize.fn('LOWER', sequelize.col('inventory_number')), {
          [Op.eq]: String(filter.inventoryNumber).toLowerCase(),
        })
      );
    }
    if (filter.serialNumber && !filter.query) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(sequelize.fn('LOWER', sequelize.col('serial_number')), {
          [Op.eq]: String(filter.serialNumber).toLowerCase(),
        })
      );
    }

    if (searchPredicates.length) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({ [Op.or]: searchPredicates });
    }

    return { where, include, paranoid: filter.includeDeleted ? false : undefined };
  }

  async updateAsset(id, updates) {
    const {
      Asset,
      CustomFieldDefinition,
      CustomFieldValue,
      sequelize,
    } = this.models;
    return sequelize.transaction(async (transaction) => {
      const asset = await Asset.findByPk(id, { transaction });
      if (!asset) {
        throw new Error('Asset not found');
      }
      const allowed = pickDefined(updates, [
        'assetModelId',
        'storageLocationId',
        'inventoryNumber',
        'serialNumber',
        'condition',
        'isActive',
      ]);
      if (allowed.inventoryNumber === '') {
        allowed.inventoryNumber = null;
      }
      if (allowed.serialNumber === '') {
        allowed.serialNumber = null;
      }
      if (Object.prototype.hasOwnProperty.call(allowed, 'storageLocationId') && allowed.storageLocationId === '') {
        allowed.storageLocationId = null;
      }
      if (allowed.assetModelId) {
        const nextModel = await this.models.AssetModel.findByPk(allowed.assetModelId, { transaction });
        if (!nextModel) {
          throw new Error('AssetModel not found');
        }
        if (nextModel.lendingLocationId !== asset.lendingLocationId) {
          throw new Error('AssetModel does not belong to lending location');
        }
      }
      if (Object.prototype.hasOwnProperty.call(allowed, 'storageLocationId') && allowed.storageLocationId) {
        const storage = await this.models.StorageLocation.findByPk(allowed.storageLocationId, { transaction });
        if (!storage) {
          throw new Error('StorageLocation not found');
        }
        if (storage.lendingLocationId !== asset.lendingLocationId) {
          throw new Error('StorageLocation does not belong to lending location');
        }
      }
      await asset.update(allowed, { transaction });
      if (Array.isArray(updates.customFieldValues)) {
        await this.#setCustomFieldValues(asset, updates.customFieldValues, {
          CustomFieldDefinition,
          CustomFieldValue,
          transaction,
        });
      }
      return asset;
    });
  }

  async moveStorageLocation(id, storageLocationId) {
    const asset = await this.getById(id);
    await asset.update({ storageLocationId });
    return asset;
  }

  async setCondition(id, condition) {
    const asset = await this.getById(id);
    await asset.update({ condition });
    return asset;
  }

  async setActive(id, nextIsActive) {
    if (nextIsActive === undefined) {
      throw new Error('nextIsActive is required');
    }
    const asset = await this.getById(id);
    await asset.update({ isActive: Boolean(nextIsActive) });
    return asset;
  }

  async deleteAsset(id) {
    const asset = await this.getById(id);
    await asset.destroy();
    return true;
  }

  async restoreAsset(id) {
    const restored = await this.models.Asset.restore({ where: { id } });
    if (!restored) {
      throw new Error('Asset not found');
    }
    return this.getById(id);
  }

  #assertCustomFieldDefinitionApplies(definition, asset) {
    if (definition.scope === 'asset_model' && definition.assetModelId !== asset.assetModelId) {
      throw new Error('CustomFieldDefinition does not apply to asset model');
    }
    if (
      definition.scope === 'lending_location' &&
      definition.lendingLocationId !== asset.lendingLocationId
    ) {
      throw new Error('CustomFieldDefinition does not apply to lending location');
    }
  }

  async #loadActiveCustomFieldDefinitions(CustomFieldDefinition, transaction) {
    return CustomFieldDefinition.findAll({
      where: { isActive: true },
      transaction,
    });
  }

  async #loadExistingCustomFieldValueMap(CustomFieldValue, assetId, transaction) {
    const existingRows = await CustomFieldValue.findAll({
      where: { assetInstanceId: assetId },
      transaction,
    });
    // Custom field writes are upserted by (assetInstanceId, customFieldDefinitionId).
    return new Map(existingRows.map((row) => [row.customFieldDefinitionId, row]));
  }

  #buildCustomFieldValuePayload(definitionId, assetId, normalizedValue) {
    return {
      customFieldDefinitionId: definitionId,
      assetInstanceId: assetId,
      valueString: normalizedValue.valueString,
      valueNumber: normalizedValue.valueNumber,
      valueBoolean: normalizedValue.valueBoolean,
      valueDate: normalizedValue.valueDate,
    };
  }

  async #setCustomFieldValues(asset, values, ctx) {
    const { CustomFieldDefinition, CustomFieldValue, transaction } = ctx;
    const definitions = await this.#loadActiveCustomFieldDefinitions(
      CustomFieldDefinition,
      transaction
    );
    const defMap = new Map(definitions.map((def) => [def.id, def]));
    const existingByDefinitionId = await this.#loadExistingCustomFieldValueMap(
      CustomFieldValue,
      asset.id,
      transaction
    );
    for (const customFieldInput of values) {
      const definition = defMap.get(customFieldInput.customFieldDefinitionId);
      if (!definition) {
        throw new Error('CustomFieldDefinition not found');
      }
      this.#assertCustomFieldDefinitionApplies(definition, asset);
      const normalizedValue = this.#normalizeValue(definition, customFieldInput.value);
      if (definition.required && normalizedValue.isNull) {
        throw new Error('CustomFieldValue is required');
      }
      const existing = existingByDefinitionId.get(definition.id) || null;
      const payload = this.#buildCustomFieldValuePayload(
        definition.id,
        asset.id,
        normalizedValue
      );
      if (existing) {
        await existing.update(payload, { transaction });
      } else {
        await CustomFieldValue.create(payload, { transaction });
      }
    }
  }

  #resolveEnumAllowedValues(enumValues) {
    if (Array.isArray(enumValues)) {
      return enumValues;
    }
    if (typeof enumValues !== 'string') {
      return [];
    }
    try {
      const parsed = JSON.parse(enumValues);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (err) {
      // fallback below
    }
    return enumValues.split(',').map((entry) => entry.trim()).filter(Boolean);
  }

  #normalizeValue(definition, value) {
    const effectiveValue = value !== undefined && value !== null ? value : definition.defaultValue;
    if (effectiveValue === undefined || effectiveValue === null || effectiveValue === '') {
      return {
        isNull: true,
        valueString: null,
        valueNumber: null,
        valueBoolean: null,
        valueDate: null,
      };
    }
    // This normalizer expects typed inputs; callers must pre-parse form strings before passing values.
    switch (definition.type) {
      case 'string':
      case 'text':
        if (typeof effectiveValue !== 'string') {
          throw new Error('Value must be a string');
        }
        return {
          isNull: false,
          valueString: effectiveValue,
          valueNumber: null,
          valueBoolean: null,
          valueDate: null,
        };
      case 'number':
        if (typeof effectiveValue !== 'number' || Number.isNaN(effectiveValue)) {
          throw new Error('Value must be a number');
        }
        return {
          isNull: false,
          valueString: null,
          valueNumber: effectiveValue,
          valueBoolean: null,
          valueDate: null,
        };
      case 'boolean':
        if (typeof effectiveValue !== 'boolean') {
          throw new Error('Value must be a boolean');
        }
        return {
          isNull: false,
          valueString: null,
          valueNumber: null,
          valueBoolean: effectiveValue,
          valueDate: null,
        };
      case 'date': {
        const dateValue = effectiveValue instanceof Date ? effectiveValue : new Date(effectiveValue);
        if (Number.isNaN(dateValue.getTime())) {
          throw new Error('Value must be a valid date');
        }
        const isoDate = dateValue.toISOString().slice(0, 10);
        return {
          isNull: false,
          valueString: null,
          valueNumber: null,
          valueBoolean: null,
          valueDate: isoDate,
        };
      }
      case 'enum': {
        const allowedValues = this.#resolveEnumAllowedValues(definition.enumValues);
        if (!allowedValues.length) {
          throw new Error('Enum values are not configured');
        }
        if (typeof effectiveValue !== 'string') {
          throw new Error('Value must be a string');
        }
        if (!allowedValues.includes(effectiveValue)) {
          throw new Error('Value is not in enumValues');
        }
        return {
          isNull: false,
          valueString: effectiveValue,
          valueNumber: null,
          valueBoolean: null,
          valueDate: null,
        };
      }
      default:
        throw new Error('Unsupported custom field type');
    }
  }
}

module.exports = AssetInstanceService;
