const { parse } = require('csv-parse/sync');
const { Op } = require('sequelize');
const {
  TRACKING_TYPE,
} = require('../config/dbConstants');
const { parseBooleanToken } = require('../utils/valueParsing');
const { DEFAULT_ITEM_QUANTITY, parsePositiveQuantity } = require('../utils/quantity');

const CSV_HEADERS = Object.freeze({
  MANUFACTURER: ['Manufacturer'],
  MODEL: ['Model'],
  CATEGORY: ['Category'],
  TRACKING_TYPE: ['TrackingType'],
  INVENTORY_NUMBER: ['InventoryNumber'],
  SERIAL_NUMBER: ['SerialNumber'],
  DESCRIPTION: ['Description'],
  TECHNICAL_DESCRIPTION: ['TechnicalDescription'],
  IMAGE_URL: ['ImageURL', 'ImageUrl'],
  IS_ACTIVE: ['IsActive'],
  STATUS: ['Status'],
  CONDITION: ['Condition'],
  STORAGE_LOCATION: ['StorageLocation', 'Lagerort'],
  QUANTITY_TOTAL: ['QuantityTotal'],
  QUANTITY_AVAILABLE: ['QuantityAvailable'],
  BUNDLE_NAME: ['BundleName'],
  BUNDLE_DESCRIPTION: ['BundleDescription'],
  BUNDLE_COMPONENTS: ['BundleComponents'],
});

const BUNDLE_OPTIONAL_TRUE_TOKENS = Object.freeze(['1', 'true', 'yes', 'ja', 'optional']);
const BUNDLE_OPTIONAL_FALSE_TOKENS = Object.freeze(['0', 'false', 'no', 'nein', 'required']);

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
    const raw = this.readColumn(row, ...CSV_HEADERS.TRACKING_TYPE);
    const normalized = String(raw || '').trim().toLowerCase();
    if (Object.values(TRACKING_TYPE).includes(normalized)) {
      return normalized;
    }

    const bundleComponents = String(this.readColumn(row, ...CSV_HEADERS.BUNDLE_COMPONENTS) || '').trim();
    const quantityTotal = this.readColumn(row, ...CSV_HEADERS.QUANTITY_TOTAL);
    const quantityAvailable = this.readColumn(row, ...CSV_HEADERS.QUANTITY_AVAILABLE);
    if (bundleComponents) {
      return TRACKING_TYPE.BUNDLE;
    }
    if (
      (quantityTotal !== undefined && String(quantityTotal).trim() !== '') ||
      (quantityAvailable !== undefined && String(quantityAvailable).trim() !== '')
    ) {
      return TRACKING_TYPE.BULK;
    }
    return TRACKING_TYPE.SERIALIZED;
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
          quantity = parsePositiveQuantity(segments[1], DEFAULT_ITEM_QUANTITY);
          const optionalRaw = String(segments[2] || '').trim().toLowerCase();
          isOptional = parseBooleanToken(optionalRaw, {
            trueTokens: BUNDLE_OPTIONAL_TRUE_TOKENS,
            falseTokens: BUNDLE_OPTIONAL_FALSE_TOKENS,
            defaultValue: false,
          });
        } else if (part.includes('*')) {
          const segments = part.split('*').map((segment) => segment.trim());
          componentName = segments[0] || '';
          quantity = parsePositiveQuantity(segments[1], DEFAULT_ITEM_QUANTITY);
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
    const required = [
      CSV_HEADERS.MANUFACTURER[0],
      CSV_HEADERS.MODEL[0],
      CSV_HEADERS.CATEGORY[0],
    ];
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
        const parsedBoolean = parseBooleanToken(effectiveValue, {
          trueTokens: ['true', '1', 'yes', 'ja'],
          falseTokens: ['false', '0', 'no', 'nein'],
          defaultValue: undefined,
        });
        if (parsedBoolean === true) {
          return { isNull: false, valueBoolean: true };
        }
        if (parsedBoolean === false) {
          return { isNull: false, valueBoolean: false };
        }
        throw new Error(`${definition.label || definition.key} muss true/false sein`);
      }
      case 'date': {
        const parsedDate = new Date(effectiveValue);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new Error(`${definition.label || definition.key} muss ein Datum sein`);
        }
        const isoDate = parsedDate.toISOString().slice(0, 10);
        return { isNull: false, valueDate: isoDate };
      }
      case 'enum': {
        let allowedEnumValues = [];
        if (Array.isArray(definition.enumValues)) {
          allowedEnumValues = definition.enumValues;
        } else if (typeof definition.enumValues === 'string') {
          try {
            const parsedEnumValues = JSON.parse(definition.enumValues);
            if (Array.isArray(parsedEnumValues)) {
              allowedEnumValues = parsedEnumValues;
            }
          } catch (err) {
            allowedEnumValues = definition.enumValues.split(',').map((value) => value.trim()).filter(Boolean);
          }
        }
        if (!allowedEnumValues.length) {
          throw new Error(`${definition.label || definition.key} hat keine Enum-Werte`);
        }
        const value = String(effectiveValue);
        if (!allowedEnumValues.includes(value)) {
          throw new Error(`${definition.label || definition.key} muss einer der Werte ${allowedEnumValues.join(', ')} sein`);
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

  async createOrFindStorageLocation({ name, lendingLocationId }, transaction) {
    let storageLocation = await this.models.StorageLocation.findOne({
      where: { name, lendingLocationId },
      transaction,
    });
    if (!storageLocation) {
      storageLocation = await this.models.StorageLocation.create(
        { name, lendingLocationId, isActive: true },
        { transaction }
      );
    }
    return storageLocation;
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
      : TRACKING_TYPE.SERIALIZED;
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
      const updatePayload = {
        assetModelId: data.assetModelId,
        serialNumber: data.serialNumber || null,
        condition: data.condition || asset.condition,
        isActive: data.isActive !== undefined ? data.isActive : asset.isActive,
      };
      if (Object.prototype.hasOwnProperty.call(data, 'storageLocationId')) {
        updatePayload.storageLocationId = data.storageLocationId;
      }
      await asset.update(
        updatePayload,
        { transaction }
      );
      return { asset, created: false };
    }
    const createPayload = {
      assetModelId: data.assetModelId,
      lendingLocationId: data.lendingLocationId,
      inventoryNumber: data.inventoryNumber || null,
      serialNumber: data.serialNumber || null,
      condition: data.condition || 'good',
      isActive: data.isActive !== undefined ? data.isActive : true,
      storageLocationId: null,
    };
    if (Object.prototype.hasOwnProperty.call(data, 'storageLocationId')) {
      createPayload.storageLocationId = data.storageLocationId;
    }
    const created = await this.models.Asset.create(
      createPayload,
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
    return parseBooleanToken(value, { defaultValue: undefined });
  }

  buildRowContext({ row, rowNumber, lendingLocationId }) {
    return {
      row,
      rowNumber,
      lendingLocationId,
      manufacturerName: String(this.readColumn(row, ...CSV_HEADERS.MANUFACTURER) || '').trim(),
      modelName: String(this.readColumn(row, ...CSV_HEADERS.MODEL) || '').trim(),
      categoryName: String(this.readColumn(row, ...CSV_HEADERS.CATEGORY) || '').trim(),
      trackingType: this.parseTrackingType(row),
      inventoryNumber: String(this.readColumn(row, ...CSV_HEADERS.INVENTORY_NUMBER) || '').trim(),
      serialNumber: String(this.readColumn(row, ...CSV_HEADERS.SERIAL_NUMBER) || '').trim(),
      rawStorageLocation: this.readColumn(row, ...CSV_HEADERS.STORAGE_LOCATION),
    };
  }

  validateRowContext(rowContext) {
    const errors = [];
    if (!rowContext.manufacturerName) {
      errors.push('Manufacturer fehlt');
    }
    if (!rowContext.modelName) {
      errors.push('Model fehlt');
    }
    if (!rowContext.categoryName) {
      errors.push('Category fehlt');
    }
    return errors;
  }

  async upsertDependencies(rowContext, transaction) {
    const manufacturer = await this.createOrFindManufacturer(
      { name: rowContext.manufacturerName, lendingLocationId: rowContext.lendingLocationId },
      transaction
    );
    const category = await this.createOrFindCategory(
      { name: rowContext.categoryName, lendingLocationId: rowContext.lendingLocationId },
      transaction
    );
    const model = await this.createOrFindModel(
      {
        name: rowContext.modelName,
        manufacturerId: manufacturer.id,
        categoryId: category.id,
        lendingLocationId: rowContext.lendingLocationId,
        description: this.readColumn(rowContext.row, ...CSV_HEADERS.DESCRIPTION),
        technicalDescription: this.readColumn(rowContext.row, ...CSV_HEADERS.TECHNICAL_DESCRIPTION),
        imageUrl: this.readColumn(rowContext.row, ...CSV_HEADERS.IMAGE_URL),
        isActive: this.parseBoolean(this.readColumn(rowContext.row, ...CSV_HEADERS.IS_ACTIVE)),
        trackingType: rowContext.trackingType,
      },
      transaction
    );
    return { manufacturer, category, model };
  }

  async importBulkRow(rowContext, model, transaction, importExecutionContext) {
    const { results } = importExecutionContext;
    const quantityTotal = Math.max(
      this.parseInteger(this.readColumn(rowContext.row, ...CSV_HEADERS.QUANTITY_TOTAL), 0),
      0
    );
    const quantityAvailable = Math.max(
      this.parseInteger(this.readColumn(rowContext.row, ...CSV_HEADERS.QUANTITY_AVAILABLE), quantityTotal),
      0
    );
    await this.models.InventoryStock.findOrCreate({
      where: {
        assetModelId: model.id,
        lendingLocationId: rowContext.lendingLocationId,
      },
      defaults: {
        assetModelId: model.id,
        lendingLocationId: rowContext.lendingLocationId,
        quantityTotal: 0,
        quantityAvailable: 0,
      },
      transaction,
    });
    const stock = await this.models.InventoryStock.findOne({
      where: { assetModelId: model.id, lendingLocationId: rowContext.lendingLocationId },
      transaction,
    });
    await stock.update(
      {
        quantityTotal,
        quantityAvailable: Math.min(quantityAvailable, quantityTotal),
      },
      { transaction }
    );
    results.updated.push({
      row: rowContext.rowNumber,
      modelId: model.id,
      type: TRACKING_TYPE.BULK,
    });
  }

  queueBundleRow(rowContext, model, importExecutionContext) {
    const { bundleQueue, results } = importExecutionContext;
    bundleQueue.push({
      row: rowContext.rowNumber,
      modelId: model.id,
      lendingLocationId: rowContext.lendingLocationId,
      bundleName: String(
        this.readColumn(rowContext.row, ...CSV_HEADERS.BUNDLE_NAME) || model.name || ''
      ).trim(),
      bundleDescription: String(
        this.readColumn(rowContext.row, ...CSV_HEADERS.BUNDLE_DESCRIPTION) || model.description || ''
      ).trim(),
      bundleComponentsRaw: this.readColumn(rowContext.row, ...CSV_HEADERS.BUNDLE_COMPONENTS),
    });
    results.updated.push({
      row: rowContext.rowNumber,
      modelId: model.id,
      type: TRACKING_TYPE.BUNDLE,
    });
  }

  async importSerializedRow(rowContext, model, transaction, importExecutionContext) {
    const { results } = importExecutionContext;
    if (!rowContext.inventoryNumber && !rowContext.serialNumber) {
      results.updated.push({
        row: rowContext.rowNumber,
        modelId: model.id,
        type: TRACKING_TYPE.SERIALIZED,
      });
      return;
    }

    const assetStatus = this.parseBoolean(this.readColumn(rowContext.row, ...CSV_HEADERS.STATUS));
    const assetActive = assetStatus !== undefined
      ? assetStatus
      : this.parseBoolean(this.readColumn(rowContext.row, ...CSV_HEADERS.IS_ACTIVE));

    let storageLocationId;
    const hasStorageLocationColumn = rowContext.rawStorageLocation !== undefined;
    if (hasStorageLocationColumn) {
      const storageLocationName = String(rowContext.rawStorageLocation || '').trim();
      if (storageLocationName) {
        const storageLocation = await this.createOrFindStorageLocation(
          {
            name: storageLocationName,
            lendingLocationId: rowContext.lendingLocationId,
          },
          transaction
        );
        storageLocationId = storageLocation.id;
      } else {
        storageLocationId = null;
      }
    }

    const { asset, created } = await this.createOrUpdateAssetInstance(
      {
        assetModelId: model.id,
        lendingLocationId: rowContext.lendingLocationId,
        inventoryNumber: rowContext.inventoryNumber,
        serialNumber: rowContext.serialNumber,
        condition: this.readColumn(rowContext.row, ...CSV_HEADERS.CONDITION),
        isActive: assetActive,
        ...(hasStorageLocationColumn ? { storageLocationId } : {}),
      },
      transaction
    );

    if (created) {
      results.created.push(asset.id);
    } else {
      results.updated.push(asset.id);
    }
  }

  async upsertBundleDefinition(pendingBundleRow, transaction) {
    const existingBundle = await this.models.BundleDefinition.findOne({
      where: {
        assetModelId: pendingBundleRow.modelId,
        lendingLocationId: pendingBundleRow.lendingLocationId,
      },
      transaction,
    });

    const bundleDefinition = existingBundle
      ? existingBundle
      : await this.models.BundleDefinition.create(
        {
          assetModelId: pendingBundleRow.modelId,
          lendingLocationId: pendingBundleRow.lendingLocationId,
          name: pendingBundleRow.bundleName || `Bundle ${pendingBundleRow.modelId}`,
          description: pendingBundleRow.bundleDescription || null,
        },
        { transaction }
      );

    if (existingBundle) {
      await bundleDefinition.update(
        {
          name: pendingBundleRow.bundleName || bundleDefinition.name,
          description: pendingBundleRow.bundleDescription || null,
        },
        { transaction }
      );
    }
    return bundleDefinition;
  }

  async replaceBundleItems(bundleDefinition, pendingBundleRow, transaction) {
    const parsedComponents = this.parseBundleComponents(pendingBundleRow.bundleComponentsRaw);
    await this.models.BundleItem.destroy({
      where: { bundleDefinitionId: bundleDefinition.id },
      transaction,
    });

    for (const componentEntry of parsedComponents) {
      // Bundle component names are resolved within the same lending location scope.
      const componentModel = await this.models.AssetModel.findOne({
        where: {
          name: componentEntry.componentName,
          lendingLocationId: pendingBundleRow.lendingLocationId,
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
  }

  async resolveBundleQueueSecondPass(importExecutionContext, transaction) {
    const { bundleQueue, results } = importExecutionContext;
    // Second pass resolves references that may point to rows imported later in the same file.
    for (const pendingBundleRow of bundleQueue) {
      try {
        const bundleDefinition = await this.upsertBundleDefinition(pendingBundleRow, transaction);
        await this.replaceBundleItems(bundleDefinition, pendingBundleRow, transaction);
      } catch (err) {
        results.errors.push({
          row: pendingBundleRow.row,
          errors: [err.message || 'Bundle Import fehlgeschlagen'],
        });
      }
    }
  }

  async importRow(rowContext, transaction, importExecutionContext) {
    const rowErrors = this.validateRowContext(rowContext);
    if (rowErrors.length) {
      const err = new Error('Row validation failed');
      err.details = rowErrors;
      throw err;
    }

    const { model } = await this.upsertDependencies(rowContext, transaction);

    const assetTrackingType = rowContext.trackingType;
    if (assetTrackingType === TRACKING_TYPE.BULK) {
      await this.importBulkRow(rowContext, model, transaction, importExecutionContext);
      return;
    }
    if (assetTrackingType === TRACKING_TYPE.BUNDLE) {
      this.queueBundleRow(rowContext, model, importExecutionContext);
      return;
    }
    await this.importSerializedRow(rowContext, model, transaction, importExecutionContext);
  }

  async importRowSafely(executionContext) {
    const { transaction, rowNumber, row, importExecutionContext } = executionContext;
    // Row numbers are 1-based to match spreadsheet line numbers shown to users.
    // Row errors are collected and import continues by design (best-effort import).
    try {
      const rowContext = this.buildRowContext({
        row,
        rowNumber,
        lendingLocationId: importExecutionContext.context.lendingLocationId,
      });
      await this.importRow(rowContext, transaction, importExecutionContext);
    } catch (err) {
      const errors = err && err.details ? err.details : [err.message || 'Import fehlgeschlagen'];
      importExecutionContext.results.errors.push({ row: rowNumber, errors });
    }
  }

  createImportExecutionContext(options) {
    return {
      context: {
        lendingLocationId: options.lendingLocationId,
      },
      results: { created: [], updated: [], errors: [] },
      bundleQueue: [],
    };
  }

  async assertImportLendingLocation(lendingLocationId) {
    if (!lendingLocationId) {
      throw new Error('LendingLocationId is required');
    }
    const location = await this.models.LendingLocation.findByPk(lendingLocationId);
    if (!location) {
      throw new Error('LendingLocation not found');
    }
  }

  async processRowsFirstPass(rows, transaction, importExecutionContext) {
    for (let index = 0; index < rows.length; index += 1) {
      await this.importRowSafely({
        transaction,
        rowNumber: index + 1,
        row: rows[index],
        importExecutionContext,
      });
    }
  }

  async processBundleRowsSecondPass(importExecutionContext, transaction) {
    await this.resolveBundleQueueSecondPass(importExecutionContext, transaction);
  }

  async importAssets(buffer, options = {}) {
    const rows = await this.parseFile(buffer, options.filename || '');
    const headers = rows.length ? Object.keys(rows[0]) : [];
    this.validateHeaders(headers);

    const importExecutionContext = this.createImportExecutionContext(options);
    const { lendingLocationId } = importExecutionContext.context;
    await this.assertImportLendingLocation(lendingLocationId);

    await this.models.sequelize.transaction(async (transaction) => {
      await this.processRowsFirstPass(rows, transaction, importExecutionContext);
      await this.processBundleRowsSecondPass(importExecutionContext, transaction);
    });

    return importExecutionContext.results;
  }
}

module.exports = CsvImportService;
