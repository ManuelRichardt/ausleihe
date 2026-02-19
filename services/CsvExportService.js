const { stringify } = require('csv-stringify/sync');
const { parseBooleanToken, toActiveStatusLabel } = require('../utils/valueParsing');
const { DEFAULT_ITEM_QUANTITY, parsePositiveQuantity } = require('../utils/quantity');

const EXPORT_COLUMN_SCHEMAS = Object.freeze({
  ASSET_MODEL: [
    { key: 'manufacturer', header: 'Manufacturer' },
    { key: 'model', header: 'Model' },
    { key: 'category', header: 'Category' },
    { key: 'description', header: 'Description' },
    { key: 'technicalDescription', header: 'TechnicalDescription' },
    { key: 'imageUrl', header: 'ImageUrl' },
    { key: 'isActive', header: 'IsActive' },
  ],
  INVENTORY_COMBINED: [
    { key: 'manufacturer', header: 'Manufacturer' },
    { key: 'model', header: 'Model' },
    { key: 'category', header: 'Category' },
    { key: 'description', header: 'Description' },
    { key: 'technicalDescription', header: 'TechnicalDescription' },
    { key: 'imageUrl', header: 'ImageURL' },
    { key: 'trackingType', header: 'TrackingType' },
    { key: 'isActive', header: 'IsActive' },
    { key: 'inventoryNumber', header: 'InventoryNumber' },
    { key: 'serialNumber', header: 'SerialNumber' },
    { key: 'status', header: 'Status' },
    { key: 'condition', header: 'Condition' },
    { key: 'lendingLocation', header: 'LendingLocation' },
    { key: 'quantityTotal', header: 'QuantityTotal' },
    { key: 'quantityAvailable', header: 'QuantityAvailable' },
    { key: 'bundleName', header: 'BundleName' },
    { key: 'bundleDescription', header: 'BundleDescription' },
    { key: 'bundleComponents', header: 'BundleComponents' },
  ],
});

const GLOBAL_BUNDLE_LOCATION_KEY = 'global';

class CsvExportService {
  constructor(models) {
    this.models = models;
  }

  generateCsvBuffer(headers, records) {
    const csv = stringify(records, { header: true, columns: headers });
    const bom = '\ufeff';
    return Buffer.from(bom + csv, 'utf8');
  }

  async generateExcelBuffer(headers, records, sheetName = 'Export') {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.columns = headers.map((header) => ({
      header: header.header,
      key: header.key,
    }));
    records.forEach((record) => {
      worksheet.addRow(record);
    });
    return workbook.xlsx.writeBuffer();
  }

  async generateExcelWorkbook(sheets = []) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    sheets.forEach((sheet) => {
      const worksheet = workbook.addWorksheet(sheet.name || 'Sheet');
      worksheet.columns = sheet.headers.map((header) => ({
        header: header.header,
        key: header.key,
      }));
      sheet.records.forEach((record) => {
        worksheet.addRow(record);
      });
    });
    return workbook.xlsx.writeBuffer();
  }

  buildModelExportHeaders() {
    return [...EXPORT_COLUMN_SCHEMAS.ASSET_MODEL];
  }

  buildModelRecords(models) {
    return models.map((model) => ({
      manufacturer: model.manufacturer ? model.manufacturer.name : '',
      model: model.name,
      category: model.category ? model.category.name : '',
      description: model.description || '',
      technicalDescription: model.technicalDescription || '',
      imageUrl: model.imageUrl || '',
      isActive: model.isActive ? 'true' : 'false',
    }));
  }

  parseActiveFilter(statusValue) {
    return parseBooleanToken(statusValue, {
      trueTokens: ['active', 'true', '1', 'yes', 'ja'],
      falseTokens: ['inactive', 'blocked', 'false', '0', 'no', 'nein'],
      defaultValue: undefined,
    });
  }

  buildStockKey(assetModelId, lendingLocationId) {
    return `${assetModelId}:${lendingLocationId}`;
  }

  buildBundleKey(assetModelId, lendingLocationId) {
    const locationKey = lendingLocationId || GLOBAL_BUNDLE_LOCATION_KEY;
    return `${assetModelId}:${locationKey}`;
  }

  buildBulkCombinedRecord(baseRecord, model, stockByKey) {
    const stock = stockByKey.get(this.buildStockKey(model.id, model.lendingLocationId)) || null;
    return {
      ...baseRecord,
      status: toActiveStatusLabel(baseRecord.isActive === 'true'),
      quantityTotal: stock ? String(stock.quantityTotal) : '0',
      quantityAvailable: stock ? String(stock.quantityAvailable) : '0',
    };
  }

  buildBundleCombinedRecord(baseRecord, model, bundleByKey) {
    const bundle =
      bundleByKey.get(this.buildBundleKey(model.id, model.lendingLocationId)) ||
      bundleByKey.get(this.buildBundleKey(model.id, GLOBAL_BUNDLE_LOCATION_KEY)) ||
      null;
    return {
      ...baseRecord,
      status: toActiveStatusLabel(baseRecord.isActive === 'true'),
      bundleName: bundle && bundle.name ? bundle.name : model.name,
      bundleDescription: bundle && bundle.description ? bundle.description : (model.description || ''),
      bundleComponents: this.serializeBundleItems(bundle),
    };
  }

  buildSerializedCombinedRecords(baseRecord, model, assetActiveFilter) {
    const assets = Array.isArray(model.assets) ? model.assets : [];
    const filteredAssets = assetActiveFilter === undefined
      ? assets
      : assets.filter((asset) => Boolean(asset.isActive) === assetActiveFilter);

    if (!filteredAssets.length) {
      if (assetActiveFilter !== undefined) {
        return [];
      }
      return [baseRecord];
    }

    return filteredAssets.map((asset) => ({
      ...baseRecord,
      isActive: asset.isActive ? 'true' : 'false',
      inventoryNumber: asset.inventoryNumber || '',
      serialNumber: asset.serialNumber || '',
      status: toActiveStatusLabel(asset.isActive),
      condition: asset.condition || '',
    }));
  }

  buildCombinedHeaders() {
    return [...EXPORT_COLUMN_SCHEMAS.INVENTORY_COMBINED];
  }

  serializeBundleItems(bundleDefinition) {
    if (!bundleDefinition || !Array.isArray(bundleDefinition.items) || !bundleDefinition.items.length) {
      return '';
    }
    return bundleDefinition.items
      .map((item) => {
        const componentName = item.componentModel ? item.componentModel.name : '';
        const quantity = parsePositiveQuantity(item.quantity, DEFAULT_ITEM_QUANTITY);
        const optionalFlag = item.isOptional ? 'optional' : 'required';
        return `${componentName}|${quantity}|${optionalFlag}`;
      })
      .join('; ');
  }

  buildCombinedBaseRecord(model) {
    return {
      manufacturer: model && model.manufacturer ? model.manufacturer.name : '',
      model: model ? model.name : '',
      category: model && model.category ? model.category.name : '',
      description: model && model.description ? model.description : '',
      technicalDescription: model && model.technicalDescription ? model.technicalDescription : '',
      imageUrl: model && model.imageUrl ? model.imageUrl : '',
      trackingType: model && model.trackingType ? model.trackingType : 'serialized',
      isActive: model && model.isActive ? 'true' : 'false',
      inventoryNumber: '',
      serialNumber: '',
      status: toActiveStatusLabel(Boolean(model && model.isActive)),
      condition: '',
      lendingLocation: model && model.lendingLocation ? model.lendingLocation.name : '',
      quantityTotal: '',
      quantityAvailable: '',
      bundleName: '',
      bundleDescription: '',
      bundleComponents: '',
    };
  }

  async loadCombinedSourceData(combinedFilters = {}) {
    const modelWhere = {};
    if (combinedFilters.lendingLocationId) {
      modelWhere.lendingLocationId = combinedFilters.lendingLocationId;
    }
    if (combinedFilters.categoryId) {
      modelWhere.categoryId = combinedFilters.categoryId;
    }
    const modelActivityFilter = this.parseActiveFilter(combinedFilters.modelStatus);
    // Model status filter and asset status filter are intentionally independent.
    const assetActivityFilter = this.parseActiveFilter(combinedFilters.status);
    if (modelActivityFilter !== undefined) {
      modelWhere.isActive = modelActivityFilter;
    }

    const assetModels = await this.models.AssetModel.findAll({
      where: modelWhere,
      include: [
        { model: this.models.Manufacturer, as: 'manufacturer' },
        { model: this.models.AssetCategory, as: 'category' },
        { model: this.models.LendingLocation, as: 'lendingLocation' },
        {
          model: this.models.Asset,
          as: 'assets',
          required: false,
        },
      ],
      order: [['name', 'ASC']],
    });

    const modelIds = assetModels.map((entry) => entry.id);
    const stockRows = modelIds.length
      ? await this.models.InventoryStock.findAll({
        where: { assetModelId: modelIds },
      })
      : [];
    const bundleRows = modelIds.length
      ? await this.models.BundleDefinition.findAll({
        where: { assetModelId: modelIds },
        include: [
          {
            model: this.models.BundleItem,
            as: 'items',
            include: [{ model: this.models.AssetModel, as: 'componentModel' }],
          },
        ],
      })
      : [];

    const stockByKey = new Map();
    stockRows.forEach((stock) => {
      stockByKey.set(this.buildStockKey(stock.assetModelId, stock.lendingLocationId), stock);
    });

    const bundleByKey = new Map();
    bundleRows.forEach((bundle) => {
      bundleByKey.set(
        this.buildBundleKey(bundle.assetModelId, bundle.lendingLocationId),
        bundle
      );
    });

    return { assetModels, stockByKey, bundleByKey, assetActivityFilter };
  }

  shapeCombinedRecords(combinedSourceData) {
    const { assetModels, stockByKey, bundleByKey, assetActivityFilter } = combinedSourceData;
    const records = [];
    assetModels.forEach((model) => {
      const trackingType = model.trackingType || 'serialized';
      const baseRecord = this.buildCombinedBaseRecord(model);

      if (trackingType === 'bulk') {
        records.push(this.buildBulkCombinedRecord(baseRecord, model, stockByKey));
        return;
      }

      if (trackingType === 'bundle') {
        records.push(this.buildBundleCombinedRecord(baseRecord, model, bundleByKey));
        return;
      }

      records.push(...this.buildSerializedCombinedRecords(baseRecord, model, assetActivityFilter));
    });
    return records;
  }

  async buildCombinedRecords(combinedFilters = {}) {
    const sourceData = await this.loadCombinedSourceData(combinedFilters);
    return this.shapeCombinedRecords(sourceData);
  }

  async buildInventoryCombinedDataset(filters = {}) {
    return {
      headers: this.buildCombinedHeaders(),
      records: await this.buildCombinedRecords(filters),
    };
  }

  async exportInventoryCombinedByFormat(filters = {}, format = 'csv', sheetName = 'Export') {
    const dataset = await this.buildInventoryCombinedDataset(filters);
    if (format === 'xlsx') {
      return this.generateExcelBuffer(dataset.headers, dataset.records, sheetName);
    }
    return this.generateCsvBuffer(dataset.headers, dataset.records);
  }

  async exportAssets(filters = {}, format = 'csv') {
    return this.exportInventoryCombinedByFormat(filters, format, 'Inventory');
  }

  async exportModels(filters = {}, format = 'csv') {
    const where = {};
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    const assetModels = await this.models.AssetModel.findAll({
      where,
      include: [
        { model: this.models.Manufacturer, as: 'manufacturer' },
        { model: this.models.AssetCategory, as: 'category' },
      ],
    });

    const headers = this.buildModelExportHeaders();
    const records = this.buildModelRecords(assetModels);

    if (format === 'xlsx') {
      return this.generateExcelBuffer(headers, records, 'Asset Models');
    }
    return this.generateCsvBuffer(headers, records);
  }

  async exportCombined(filters = {}, format = 'csv') {
    return this.exportInventoryCombinedByFormat(filters, format, 'Export');
  }

}

module.exports = CsvExportService;
