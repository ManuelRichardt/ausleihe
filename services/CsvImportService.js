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

  readColumn(row, ...keys) {
    if (!row || typeof row !== 'object') {
      return undefined;
    }
    const normalizedMap = Object.keys(row).reduce((acc, key) => {
      acc[this.normalizeHeader(key).toLowerCase()] = row[key];
      return acc;
    }, {});
    for (const key of keys) {
      const normalized = this.normalizeHeader(key).toLowerCase();
      if (Object.prototype.hasOwnProperty.call(normalizedMap, normalized)) {
        return normalizedMap[normalized];
      }
    }
    return undefined;
  }

  parseTrackingType(row) {
    const raw = this.readColumn(row, 'TrackingType');
    const normalized = String(raw || '').trim().toLowerCase();
    if (['serialized', 'bulk', 'bundle'].includes(normalized)) {
      return normalized;
    }

    const bundleComponents = String(this.readColumn(row, 'BundleComponents') || '').trim();
    const quantityTotal = this.readColumn(row, 'QuantityTotal');
    const quantityAvailable = this.readColumn(row, 'QuantityAvailable');
    if (bundleComponents) {
      return 'bundle';
    }
    if (
      (quantityTotal !== undefined && String(quantityTotal).trim() !== '') ||
      (quantityAvailable !== undefined && String(quantityAvailable).trim() !== '')
    ) {
      return 'bulk';
    }
    return 'serialized';
  }

  parseInteger(value, fallback = 0) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return fallback;
    }
    return parsed;
  }

  parseBundleComponents(raw) {
    const input = String(raw || '').trim();
    if (!input) {
      return [];
    }
    return input
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        let componentName = '';
        let quantity = 1;
        let isOptional = false;

        if (part.includes('|')) {
          const segments = part.split('|').map((segment) => segment.trim());
          componentName = segments[0] || '';
          quantity = Math.max(this.parseInteger(segments[1], 1), 1);
          const optionalRaw = String(segments[2] || '').trim().toLowerCase();
          isOptional = ['1', 'true', 'yes', 'ja', 'optional'].includes(optionalRaw);
        } else if (part.includes('*')) {
          const segments = part.split('*').map((segment) => segment.trim());
          componentName = segments[0] || '';
          quantity = Math.max(this.parseInteger(segments[1], 1), 1);
        } else {
          componentName = part;
        }

        return {
          componentName,
          quantity,
          isOptional,
        };
      })
      .filter((entry) => entry.componentName);
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

  async createOrFindModel({
    name,
    manufacturerId,
    categoryId,
    lendingLocationId,
    description,
    technicalDescription,
    imageUrl,
    isActive,
    trackingType,
  }, transaction) {
    const normalizedTrackingType = ['serialized', 'bulk', 'bundle'].includes(String(trackingType || '').trim().toLowerCase())
      ? String(trackingType).trim().toLowerCase()
      : 'serialized';
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
          trackingType: normalizedTrackingType,
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
          trackingType: normalizedTrackingType,
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

    const pendingBundleRows = [];

    await this.models.sequelize.transaction(async (transaction) => {
      for (let index = 0; index < rows.length; index += 1) {
        try {
          const row = rows[index];
          const rowErrors = [];

          const manufacturerName = String(this.readColumn(row, 'Manufacturer') || '').trim();
          const modelName = String(this.readColumn(row, 'Model') || '').trim();
          const categoryName = String(this.readColumn(row, 'Category') || '').trim();
          const trackingType = this.parseTrackingType(row);
          const inventoryNumber = String(this.readColumn(row, 'InventoryNumber') || '').trim();
          const serialNumber = String(this.readColumn(row, 'SerialNumber') || '').trim();

          if (!manufacturerName) {
            rowErrors.push('Manufacturer fehlt');
          }
          if (!modelName) {
            rowErrors.push('Model fehlt');
          }
          if (!categoryName) {
            rowErrors.push('Category fehlt');
          }

          if (rowErrors.length) {
            const err = new Error('Row validation failed');
            err.details = rowErrors;
            throw err;
          }

          const manufacturer = await this.createOrFindManufacturer(
            { name: manufacturerName, lendingLocationId },
            transaction
          );
          const category = await this.createOrFindCategory(
            { name: categoryName, lendingLocationId },
            transaction
          );

          const model = await this.createOrFindModel(
            {
              name: modelName,
              manufacturerId: manufacturer.id,
              categoryId: category.id,
              lendingLocationId,
              description: this.readColumn(row, 'Description'),
              technicalDescription: this.readColumn(row, 'TechnicalDescription'),
              imageUrl: this.readColumn(row, 'ImageURL', 'ImageUrl'),
              isActive: this.parseBoolean(this.readColumn(row, 'IsActive')),
              trackingType,
            },
            transaction
          );

          if (trackingType === 'bulk') {
            const quantityTotal = Math.max(this.parseInteger(this.readColumn(row, 'QuantityTotal'), 0), 0);
            const quantityAvailable = Math.max(
              this.parseInteger(this.readColumn(row, 'QuantityAvailable'), quantityTotal),
              0
            );
            await this.models.InventoryStock.findOrCreate({
              where: {
                assetModelId: model.id,
                lendingLocationId,
              },
              defaults: {
                assetModelId: model.id,
                lendingLocationId,
                quantityTotal: 0,
                quantityAvailable: 0,
              },
              transaction,
            });
            const stock = await this.models.InventoryStock.findOne({
              where: { assetModelId: model.id, lendingLocationId },
              transaction,
            });
            await stock.update(
              {
                quantityTotal,
                quantityAvailable: Math.min(quantityAvailable, quantityTotal),
              },
              { transaction }
            );
            results.updated.push({ row: index + 1, modelId: model.id, type: 'bulk' });
            continue;
          }

          if (trackingType === 'bundle') {
            pendingBundleRows.push({
              row: index + 1,
              modelId: model.id,
              lendingLocationId,
              bundleName: String(this.readColumn(row, 'BundleName') || model.name || '').trim(),
              bundleDescription: String(this.readColumn(row, 'BundleDescription') || model.description || '').trim(),
              bundleComponentsRaw: this.readColumn(row, 'BundleComponents'),
            });
            results.updated.push({ row: index + 1, modelId: model.id, type: 'bundle' });
            continue;
          }

          if (!inventoryNumber && !serialNumber) {
            results.updated.push({ row: index + 1, modelId: model.id, type: 'serialized' });
            continue;
          }

          const assetStatus = this.parseBoolean(this.readColumn(row, 'Status'));
          const assetActive = assetStatus !== undefined
            ? assetStatus
            : this.parseBoolean(this.readColumn(row, 'IsActive'));

          const { asset, created } = await this.createOrUpdateAssetInstance(
            {
              assetModelId: model.id,
              lendingLocationId,
              inventoryNumber,
              serialNumber,
              condition: this.readColumn(row, 'Condition'),
              isActive: assetActive,
            },
            transaction
          );

          if (created) {
            results.created.push(asset.id);
          } else {
            results.updated.push(asset.id);
          }
        } catch (err) {
          const errors = err && err.details ? err.details : [err.message || 'Import fehlgeschlagen'];
          results.errors.push({ row: index + 1, errors });
        }
      }

      for (const pending of pendingBundleRows) {
        try {
          const existingBundle = await this.models.BundleDefinition.findOne({
            where: {
              assetModelId: pending.modelId,
              lendingLocationId: pending.lendingLocationId,
            },
            transaction,
          });

          const bundleDefinition = existingBundle
            ? existingBundle
            : await this.models.BundleDefinition.create(
              {
                assetModelId: pending.modelId,
                lendingLocationId: pending.lendingLocationId,
                name: pending.bundleName || `Bundle ${pending.modelId}`,
                description: pending.bundleDescription || null,
              },
              { transaction }
            );

          if (existingBundle) {
            await bundleDefinition.update(
              {
                name: pending.bundleName || bundleDefinition.name,
                description: pending.bundleDescription || null,
              },
              { transaction }
            );
          }

          const parsedComponents = this.parseBundleComponents(pending.bundleComponentsRaw);
          await this.models.BundleItem.destroy({
            where: { bundleDefinitionId: bundleDefinition.id },
            transaction,
          });

          for (const componentEntry of parsedComponents) {
            const componentModel = await this.models.AssetModel.findOne({
              where: {
                name: componentEntry.componentName,
                lendingLocationId: pending.lendingLocationId,
              },
              transaction,
            });
            if (!componentModel) {
              throw new Error(`Komponente nicht gefunden: ${componentEntry.componentName}`);
            }
            await this.models.BundleItem.create(
              {
                bundleDefinitionId: bundleDefinition.id,
                componentAssetModelId: componentModel.id,
                quantity: componentEntry.quantity,
                isOptional: componentEntry.isOptional,
              },
              { transaction }
            );
          }
        } catch (err) {
          results.errors.push({
            row: pending.row,
            errors: [err.message || 'Bundle Import fehlgeschlagen'],
          });
        }
      }
    });

    return results;
  }
}

module.exports = CsvImportService;
