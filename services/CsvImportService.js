const { parse } = require('csv-parse/sync');
const { Op } = require('sequelize');

class CsvImportService {
  constructor(models) {
    this.models = models;
  }

  async parseFile(buffer, filename) {
    const lower = String(filename || '').toLowerCase();
    if (lower.endsWith('.xlsx')) {
      return this.parseExcel(buffer);
    }
    return this.parseCsv(buffer);
  }

  parseCsv(buffer) {
    const normalizeHeader = (header) => this.normalizeHeader(header);
    return parse(buffer, {
      columns: (header) => header.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
    });
  }

  async parseExcel(buffer) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return [];
    }
    const headerRow = worksheet.getRow(1);
    const headers = headerRow.values.slice(1).map((header) => this.normalizeHeader(header));
    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      const values = row.values.slice(1);
      const record = {};
      headers.forEach((header, index) => {
        record[header] = values[index] !== undefined ? values[index] : '';
      });
      rows.push(record);
    });
    return rows;
  }

  normalizeHeader(header) {
    const cleaned = String(header || '').replace(/^\uFEFF/, '');
    return cleaned.trim();
  }

  getCustomFieldColumns(headers) {
    return headers
      .map((header) => this.normalizeHeader(header))
      .filter((header) => header.startsWith('Custom:'))
      .map((header) => ({
        header,
        key: header.replace('Custom:', '').trim(),
      }));
  }

  validateHeaders(headers) {
    const required = ['Manufacturer', 'Model', 'Category'];
    const missing = required.filter((key) => !headers.includes(key));
    if (missing.length) {
      throw new Error(`Missing required headers: ${missing.join(', ')}`);
    }
  }

  async getCustomFieldDefinitions({ assetModelId, lendingLocationId, transaction }) {
    const { CustomFieldDefinition } = this.models;
    const where = { isActive: true, [Op.or]: [] };
    if (assetModelId) {
      where[Op.or].push({ scope: 'asset_model', assetModelId });
    }
    if (lendingLocationId) {
      where[Op.or].push({ scope: 'lending_location', lendingLocationId });
    }
    if (!where[Op.or].length) {
      return [];
    }
    return CustomFieldDefinition.findAll({ where, transaction });
  }

  normalizeCustomFieldValue(definition, rawValue) {
    const hasValue =
      rawValue !== undefined &&
      rawValue !== null &&
      String(rawValue).trim() !== '';
    const effectiveValue = hasValue ? rawValue : definition.defaultValue;

    if (
      effectiveValue === undefined ||
      effectiveValue === null ||
      String(effectiveValue).trim() === ''
    ) {
      return { isNull: true };
    }

    switch (definition.type) {
      case 'string':
      case 'text':
        return {
          isNull: false,
          valueString: String(effectiveValue),
        };
      case 'number': {
        const parsed = Number(effectiveValue);
        if (Number.isNaN(parsed)) {
          throw new Error(`${definition.label || definition.key} muss eine Zahl sein`);
        }
        return { isNull: false, valueNumber: parsed };
      }
      case 'boolean': {
        if (typeof effectiveValue === 'boolean') {
          return { isNull: false, valueBoolean: effectiveValue };
        }
        const normalized = String(effectiveValue).trim().toLowerCase();
        if (['true', '1', 'yes', 'ja'].includes(normalized)) {
          return { isNull: false, valueBoolean: true };
        }
        if (['false', '0', 'no', 'nein'].includes(normalized)) {
          return { isNull: false, valueBoolean: false };
        }
        throw new Error(`${definition.label || definition.key} muss true/false sein`);
      }
      case 'date': {
        const parsed = new Date(effectiveValue);
        if (Number.isNaN(parsed.getTime())) {
          throw new Error(`${definition.label || definition.key} muss ein Datum sein`);
        }
        const isoDate = parsed.toISOString().slice(0, 10);
        return { isNull: false, valueDate: isoDate };
      }
      case 'enum': {
        let allowed = [];
        if (Array.isArray(definition.enumValues)) {
          allowed = definition.enumValues;
        } else if (typeof definition.enumValues === 'string') {
          try {
            const parsed = JSON.parse(definition.enumValues);
            if (Array.isArray(parsed)) {
              allowed = parsed;
            }
          } catch (err) {
            allowed = definition.enumValues.split(',').map((value) => value.trim()).filter(Boolean);
          }
        }
        if (!allowed.length) {
          throw new Error(`${definition.label || definition.key} hat keine Enum-Werte`);
        }
        const value = String(effectiveValue);
        if (!allowed.includes(value)) {
          throw new Error(`${definition.label || definition.key} muss einer der Werte ${allowed.join(', ')} sein`);
        }
        return { isNull: false, valueString: value };
      }
      default:
        throw new Error(`${definition.label || definition.key} hat einen unbekannten Typ`);
    }
  }

  resolveCustomFieldValues(definitions, row, customColumns) {
    const values = [];
    const errors = [];

    definitions.forEach((definition) => {
      const column =
        customColumns.find((col) => col.key === definition.key) ||
        customColumns.find((col) => col.key === definition.label);
      const rawValue = column ? row[column.header] : undefined;
      try {
        const normalized = this.normalizeCustomFieldValue(definition, rawValue);
        if (normalized.isNull) {
          if (definition.required) {
            errors.push(`Custom Field ${definition.label || definition.key} ist erforderlich`);
          }
          return;
        }
        values.push({
          customFieldDefinitionId: definition.id,
          valueString: normalized.valueString || null,
          valueNumber: normalized.valueNumber || null,
          valueBoolean:
            typeof normalized.valueBoolean === 'boolean' ? normalized.valueBoolean : null,
          valueDate: normalized.valueDate || null,
        });
      } catch (err) {
        errors.push(err.message || 'Custom Field ist ungültig');
      }
    });

    return { values, errors };
  }

  async createOrFindManufacturer({ name, lendingLocationId }, transaction) {
    let manufacturer = await this.models.Manufacturer.findOne({
      where: { name, lendingLocationId },
      transaction,
    });
    if (!manufacturer) {
      manufacturer = await this.models.Manufacturer.create(
        { name, lendingLocationId, isActive: true },
        { transaction }
      );
    }
    return manufacturer;
  }

  async createOrFindCategory({ name, lendingLocationId }, transaction) {
    let category = await this.models.AssetCategory.findOne({
      where: { name, lendingLocationId },
      transaction,
    });
    if (!category) {
      category = await this.models.AssetCategory.create(
        { name, lendingLocationId, isActive: true },
        { transaction }
      );
    }
    return category;
  }

  async createOrFindModel({ name, manufacturerId, categoryId, lendingLocationId, description, technicalDescription, imageUrl, isActive }, transaction) {
    let model = await this.models.AssetModel.findOne({
      where: { name, manufacturerId, lendingLocationId },
      transaction,
    });
    if (!model) {
      model = await this.models.AssetModel.create(
        {
          name,
          manufacturerId,
          categoryId,
          lendingLocationId,
          description: description || null,
          technicalDescription: technicalDescription || null,
          imageUrl: imageUrl || null,
          isActive: isActive !== undefined ? isActive : true,
        },
        { transaction }
      );
    } else {
      await model.update(
        {
          categoryId,
          description: description || null,
          technicalDescription: technicalDescription || null,
          imageUrl: imageUrl || null,
          isActive: isActive !== undefined ? isActive : model.isActive,
        },
        { transaction }
      );
    }
    return model;
  }

  async createOrUpdateAssetInstance(data, transaction) {
    const where = {};
    if (data.inventoryNumber) {
      where.inventoryNumber = data.inventoryNumber;
    } else if (data.serialNumber) {
      where.serialNumber = data.serialNumber;
    }
    let asset = null;
    if (Object.keys(where).length) {
      asset = await this.models.Asset.findOne({
        where: { ...where, lendingLocationId: data.lendingLocationId },
        transaction,
      });
    }
    if (asset) {
      await asset.update(
        {
          assetModelId: data.assetModelId,
          serialNumber: data.serialNumber || null,
          condition: data.condition || asset.condition,
          isActive: data.isActive !== undefined ? data.isActive : asset.isActive,
        },
        { transaction }
      );
      return { asset, created: false };
    }
    const created = await this.models.Asset.create(
      {
        assetModelId: data.assetModelId,
        lendingLocationId: data.lendingLocationId,
        inventoryNumber: data.inventoryNumber || null,
        serialNumber: data.serialNumber || null,
        condition: data.condition || 'good',
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      { transaction }
    );
    return { asset: created, created: true };
  }

  async createCustomFieldValues(assetId, values, transaction) {
    if (!values.length) {
      return;
    }
    const payload = values.map((value) => ({
      customFieldDefinitionId: value.customFieldDefinitionId,
      assetInstanceId: assetId,
      valueString: value.valueString,
      valueNumber: value.valueNumber,
      valueBoolean: value.valueBoolean,
      valueDate: value.valueDate,
    }));
    await this.models.CustomFieldValue.bulkCreate(payload, { transaction });
  }

  parseBoolean(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (value === undefined || value === null) {
      return undefined;
    }
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'ja', 'active'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'nein', 'inactive'].includes(normalized)) {
      return false;
    }
    return undefined;
  }

  async importAssets(buffer, options = {}) {
    const rows = await this.parseFile(buffer, options.filename || '');
    const headers = rows.length ? Object.keys(rows[0]) : [];
    this.validateHeaders(headers);

    const results = { created: [], updated: [], errors: [] };
    const { lendingLocationId } = options;

    if (!lendingLocationId) {
      throw new Error('LendingLocationId is required');
    }
    const location = await this.models.LendingLocation.findByPk(lendingLocationId);
    if (!location) {
      throw new Error('LendingLocation not found');
    }

    await this.models.sequelize.transaction(async (transaction) => {
      for (let index = 0; index < rows.length; index += 1) {
        try {
          await this.models.sequelize.transaction({ transaction }, async (rowTransaction) => {
            const row = rows[index];
            const errors = [];

            const manufacturerName = row.Manufacturer;
            const modelName = row.Model;
            const categoryName = row.Category;
            const inventoryNumber = row.InventoryNumber ? String(row.InventoryNumber).trim() : '';
            const serialNumber = row.SerialNumber ? String(row.SerialNumber).trim() : '';

            if (!manufacturerName) {
              errors.push('Manufacturer fehlt');
            }
            if (!modelName) {
              errors.push('Model fehlt');
            }
            if (!categoryName) {
              errors.push('Category fehlt');
            }

            if (errors.length) {
              const err = new Error('Row validation failed');
              err.details = errors;
              throw err;
            }

            const manufacturer = await this.createOrFindManufacturer(
              { name: manufacturerName, lendingLocationId },
              rowTransaction
            );
            const category = await this.createOrFindCategory(
              { name: categoryName, lendingLocationId },
              rowTransaction
            );

            const model = await this.createOrFindModel(
              {
                name: modelName,
                manufacturerId: manufacturer.id,
                categoryId: category.id,
                lendingLocationId,
                description: row.Description,
                technicalDescription: row.TechnicalDescription,
                imageUrl: row.ImageURL,
                isActive: this.parseBoolean(row.IsActive),
              },
              rowTransaction
            );

            if (!inventoryNumber && !serialNumber) {
              results.updated.push({ row: index + 1, modelId: model.id });
              return;
            }

            const assetStatus = this.parseBoolean(row.Status);
            const assetActive = assetStatus !== undefined ? assetStatus : this.parseBoolean(row.IsActive);

            const { asset, created } = await this.createOrUpdateAssetInstance(
              {
                assetModelId: model.id,
                lendingLocationId,
                inventoryNumber,
                serialNumber,
                condition: row.Condition,
                isActive: assetActive,
              },
              rowTransaction
            );

            if (created) {
              results.created.push(asset.id);
            } else {
              results.updated.push(asset.id);
            }
          });
        } catch (err) {
          const errors = err && err.details ? err.details : [err.message || 'Import fehlgeschlagen'];
          results.errors.push({ row: index + 1, errors });
        }
      }
    });

    return results;
  }
}

module.exports = CsvImportService;
