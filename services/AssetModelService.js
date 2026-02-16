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
    this._jsonColumnsSanitized = false;
  }

  async ensureJsonColumnsSanitized() {
    if (this._jsonColumnsSanitized) {
      return;
    }

    // Legacy data can contain empty strings in JSON columns. MariaDB then throws
    // JSON parse errors when rows are read. Normalize once per process start.
    await this.models.sequelize.query(`
      UPDATE asset_models
      SET specs = '{}'
      WHERE specs IS NULL
         OR TRIM(CAST(specs AS CHAR)) = ''
         OR JSON_VALID(CAST(specs AS CHAR)) = 0
    `);

    this._jsonColumnsSanitized = true;
  }

  async getGlobalCustomFieldDefinitions(options = {}) {
    const where = { scope: 'global' };
    if (options.onlyActive !== false) {
      where.isActive = true;
    }
    return this.models.CustomFieldDefinition.findAll({
      where,
      order: [['label', 'ASC'], ['key', 'ASC']],
    });
  }

  parseBoolean(value, label) {
    if (value === true || value === false) {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'ja', 'on'].includes(normalized)) {
        return true;
      }
      if (['0', 'false', 'no', 'nein', 'off'].includes(normalized)) {
        return false;
      }
    }
    const err = new Error(`Feld "${label}" muss Ja/Nein sein`);
    err.status = 422;
    throw err;
  }

  normalizeDate(value, label) {
    const asString = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asString)) {
      const err = new Error(`Feld "${label}" muss ein gültiges Datum sein`);
      err.status = 422;
      throw err;
    }
    const parsed = new Date(`${asString}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      const err = new Error(`Feld "${label}" muss ein gültiges Datum sein`);
      err.status = 422;
      throw err;
    }
    return asString;
  }

  normalizeCustomFieldValue(definition, rawValue) {
    const label = definition.label || definition.key || 'Custom Field';
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return undefined;
    }

    switch (definition.type) {
      case 'string':
      case 'text':
        return String(rawValue);
      case 'number': {
        const numeric = Number(rawValue);
        if (Number.isNaN(numeric)) {
          const err = new Error(`Feld "${label}" muss eine Zahl sein`);
          err.status = 422;
          throw err;
        }
        return numeric;
      }
      case 'boolean':
        return this.parseBoolean(rawValue, label);
      case 'date':
        return this.normalizeDate(rawValue, label);
      case 'enum': {
        const value = String(rawValue);
        if (!Array.isArray(definition.enumValues) || !definition.enumValues.includes(value)) {
          const err = new Error(`Feld "${label}" hat einen ungültigen Wert`);
          err.status = 422;
          throw err;
        }
        return value;
      }
      default:
        return String(rawValue);
    }
  }

  async resolveCustomFieldData(rawFields) {
    const definitions = await this.getGlobalCustomFieldDefinitions({ onlyActive: true });
    if (!definitions.length) {
      return {};
    }

    const fields = rawFields && typeof rawFields === 'object' ? rawFields : {};
    const payload = {};

    for (const definition of definitions) {
      const hasIdKey = Object.prototype.hasOwnProperty.call(fields, definition.id);
      const hasFieldKey = Object.prototype.hasOwnProperty.call(fields, definition.key);
      const provided = hasIdKey ? fields[definition.id] : (hasFieldKey ? fields[definition.key] : undefined);
      const fallback = definition.defaultValue !== undefined && definition.defaultValue !== null
        ? definition.defaultValue
        : undefined;
      const value = provided === undefined || provided === null || provided === '' ? fallback : provided;

      if (value === undefined || value === null || value === '') {
        if (definition.required) {
          const err = new Error(`Feld "${definition.label}" ist erforderlich`);
          err.status = 422;
          throw err;
        }
        continue;
      }

      const normalized = this.normalizeCustomFieldValue(definition, value);
      if (normalized !== undefined) {
        payload[definition.id] = normalized;
      }
    }

    return payload;
  }

  buildCreateAssetModelPayload(data) {
    return {
      lendingLocationId: data.lendingLocationId,
      manufacturerId: data.manufacturerId,
      categoryId: data.categoryId,
      name: data.name,
      description: data.description || null,
      technicalDescription: data.technicalDescription || null,
      specs:
        data.specs && typeof data.specs === 'object'
          ? data.specs
          : {},
      imageUrl: data.imageUrl || null,
      trackingType: data.trackingType || 'serialized',
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
      'specs',
      'imageUrl',
      'trackingType',
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
    await this.ensureJsonColumnsSanitized();
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
    await this.ensureJsonColumnsSanitized();
    const where = {};
    applyLendingLocationFilter(where, filter);
    if (filter.manufacturerId) {
      where.manufacturerId = filter.manufacturerId;
    }
    if (filter.categoryId) {
      where.categoryId = filter.categoryId;
    }
    if (filter.trackingType) {
      where.trackingType = filter.trackingType;
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
    await this.ensureJsonColumnsSanitized();
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
    if (filter.trackingType) {
      where.trackingType = filter.trackingType;
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
