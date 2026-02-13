const { buildListOptions, findByPkOrThrow } = require('./_serviceUtils');

class CustomFieldValueService {
  constructor(models) {
    this.models = models;
  }

  async setValue(assetInstanceId, customFieldDefinitionId, value) {
    const { CustomFieldDefinition, CustomFieldValue, Asset, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const asset = await Asset.findByPk(assetInstanceId, { transaction });
      if (!asset) {
        throw new Error('Asset not found');
      }
      const definition = await CustomFieldDefinition.findByPk(customFieldDefinitionId, { transaction });
      if (!definition) {
        throw new Error('CustomFieldDefinition not found');
      }
      await this.#validateDefinitionAppliesToAsset(definition, asset);
      const normalized = this.#normalizeValue(definition, value);
      if (definition.required && normalized.isNull) {
        throw new Error('CustomFieldValue is required');
      }
      const payload = {
        customFieldDefinitionId,
        assetInstanceId,
        valueString: normalized.valueString,
        valueNumber: normalized.valueNumber,
        valueBoolean: normalized.valueBoolean,
        valueDate: normalized.valueDate,
      };
      const existing = await CustomFieldValue.findOne({
        where: { customFieldDefinitionId, assetInstanceId },
        transaction,
      });
      if (existing) {
        await existing.update(payload, { transaction });
        return existing;
      }
      return CustomFieldValue.create(payload, { transaction });
    });
  }

  async getValuesByAssetInstance(assetInstanceId, options = {}) {
    const asset = await this.models.Asset.findByPk(assetInstanceId);
    if (!asset) {
      throw new Error('Asset not found');
    }
    return this.models.CustomFieldValue.findAll({ where: { assetInstanceId }, ...buildListOptions(options), include: [{ model: this.models.CustomFieldDefinition, as: 'definition' }],
    });
  }

  async deleteValue(assetInstanceId, customFieldDefinitionId) {
    const deleted = await this.models.CustomFieldValue.destroy({
      where: { assetInstanceId, customFieldDefinitionId },
    });
    if (!deleted) {
      throw new Error('CustomFieldValue not found');
    }
    return true;
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
      case 'enum':
        if (!Array.isArray(definition.enumValues) || definition.enumValues.length === 0) {
          throw new Error('Enum values are not configured');
        }
        if (typeof effectiveValue !== 'string') {
          throw new Error('Value must be a string');
        }
        if (!definition.enumValues.includes(effectiveValue)) {
          throw new Error('Value is not in enumValues');
        }
        return {
          isNull: false,
          valueString: effectiveValue,
          valueNumber: null,
          valueBoolean: null,
          valueDate: null,
        };
      default:
        throw new Error('Unsupported custom field type');
    }
  }

  async #validateDefinitionAppliesToAsset(definition, asset) {
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
}

module.exports = CustomFieldValueService;
