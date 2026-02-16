const { stringify } = require('csv-stringify/sync');

class CsvExportService {
  constructor(models) {
    this.models = models;
  }

  buildAssetExportQuery(filters = {}) {
    const where = {};
    const modelWhere = {};
    if (filters.lendingLocationId) {
      where.lendingLocationId = filters.lendingLocationId;
    }
    if (filters.status) {
      where.condition = filters.status;
    }
    if (filters.categoryId) {
      modelWhere.categoryId = filters.categoryId;
    }
    return {
      where,
      include: [
        {
          model: this.models.AssetModel,
          as: 'model',
          where: modelWhere,
          required: Object.keys(modelWhere).length > 0,
          include: [
            { model: this.models.Manufacturer, as: 'manufacturer' },
            { model: this.models.AssetCategory, as: 'category' },
          ],
        },
        { model: this.models.LendingLocation, as: 'lendingLocation' },
        { model: this.models.CustomFieldValue, as: 'customFieldValues', include: [{ model: this.models.CustomFieldDefinition, as: 'definition' }] },
      ],
    };
  }

  async flattenCustomFields(instances) {
    const fieldKeys = new Map();
    instances.forEach((asset) => {
      const values = asset.customFieldValues || [];
      values.forEach((value) => {
        const def = value.definition;
        if (def && def.key) {
          fieldKeys.set(def.key, def.label || def.key);
        }
      });
    });
    return Array.from(fieldKeys.entries()).map(([key, label]) => ({ key, label }));
  }

  buildCustomFieldValueMap(asset) {
    const values = asset.customFieldValues || [];
    const map = {};
    values.forEach((value) => {
      const def = value.definition;
      if (!def || !def.key) {
        return;
      }
      if (value.valueString !== null && value.valueString !== undefined) {
        map[def.key] = value.valueString;
      } else if (value.valueNumber !== null && value.valueNumber !== undefined) {
        map[def.key] = value.valueNumber;
      } else if (typeof value.valueBoolean === 'boolean') {
        map[def.key] = value.valueBoolean;
      } else if (value.valueDate !== null && value.valueDate !== undefined) {
        map[def.key] = value.valueDate;
      } else {
        map[def.key] = '';
      }
    });
    return map;
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

  buildAssetExportHeaders(customFields) {
    const headers = [
      { key: 'manufacturer', header: 'Manufacturer' },
      { key: 'model', header: 'Model' },
      { key: 'category', header: 'Category' },
      { key: 'description', header: 'Description' },
      { key: 'inventoryNumber', header: 'InventoryNumber' },
      { key: 'serialNumber', header: 'SerialNumber' },
      { key: 'status', header: 'Status' },
      { key: 'condition', header: 'Condition' },
      { key: 'lendingLocation', header: 'LendingLocation' },
    ];
    customFields.forEach((field) => {
      headers.push({ key: `custom_${field.key}`, header: `Custom:${field.label}` });
    });
    return headers;
  }

  buildAssetRecords(instances, customFields) {
    return instances.map((asset) => {
      const customMap = this.buildCustomFieldValueMap(asset);
      const model = asset.model;
      const record = {
        manufacturer: model && model.manufacturer ? model.manufacturer.name : '',
        model: model ? model.name : '',
        category: model && model.category ? model.category.name : '',
        description: model && model.description ? model.description : '',
        inventoryNumber: asset.inventoryNumber,
        serialNumber: asset.serialNumber || '',
        status: asset.isActive ? 'active' : 'inactive',
        condition: asset.condition || '',
        lendingLocation: asset.lendingLocation ? asset.lendingLocation.name : '',
      };
      customFields.forEach((field) => {
        record[`custom_${field.key}`] = customMap[field.key] || '';
      });
      return record;
    });
  }

  buildModelExportHeaders() {
    return [
      { key: 'manufacturer', header: 'Manufacturer' },
      { key: 'model', header: 'Model' },
      { key: 'category', header: 'Category' },
      { key: 'description', header: 'Description' },
      { key: 'technicalDescription', header: 'TechnicalDescription' },
      { key: 'imageUrl', header: 'ImageUrl' },
      { key: 'isActive', header: 'IsActive' },
    ];
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
    const normalized = String(statusValue || '').trim().toLowerCase();
    if (['active', 'true', '1', 'yes', 'ja'].includes(normalized)) {
      return true;
    }
    if (['inactive', 'blocked', 'false', '0', 'no', 'nein'].includes(normalized)) {
      return false;
    }
    return undefined;
  }

  buildCombinedHeaders() {
    return [
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
    ];
  }

  serializeBundleItems(bundleDefinition) {
    if (!bundleDefinition || !Array.isArray(bundleDefinition.items) || !bundleDefinition.items.length) {
      return '';
    }
    return bundleDefinition.items
      .map((item) => {
        const componentName = item.componentModel ? item.componentModel.name : '';
        const quantity = Math.max(parseInt(item.quantity || '1', 10), 1);
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
      status: model && model.isActive ? 'active' : 'inactive',
      condition: '',
      lendingLocation: model && model.lendingLocation ? model.lendingLocation.name : '',
      quantityTotal: '',
      quantityAvailable: '',
      bundleName: '',
      bundleDescription: '',
      bundleComponents: '',
    };
  }

  async buildCombinedRecords(filters = {}) {
    const modelWhere = {};
    if (filters.lendingLocationId) {
      modelWhere.lendingLocationId = filters.lendingLocationId;
    }
    if (filters.categoryId) {
      modelWhere.categoryId = filters.categoryId;
    }
    const modelActiveFilter = this.parseActiveFilter(filters.modelStatus);
    if (modelActiveFilter !== undefined) {
      modelWhere.isActive = modelActiveFilter;
    }

    const models = await this.models.AssetModel.findAll({
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

    const modelIds = models.map((entry) => entry.id);
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
      stockByKey.set(`${stock.assetModelId}:${stock.lendingLocationId}`, stock);
    });

    const bundleByKey = new Map();
    bundleRows.forEach((bundle) => {
      const locationKey = bundle.lendingLocationId || 'global';
      bundleByKey.set(`${bundle.assetModelId}:${locationKey}`, bundle);
    });

    const assetActiveFilter = this.parseActiveFilter(filters.status);
    const records = [];
    models.forEach((model) => {
      const trackingType = model.trackingType || 'serialized';
      const base = this.buildCombinedBaseRecord(model);

      if (trackingType === 'bulk') {
        const stock = stockByKey.get(`${model.id}:${model.lendingLocationId}`) || null;
        records.push({
          ...base,
          status: base.isActive === 'true' ? 'active' : 'inactive',
          quantityTotal: stock ? String(stock.quantityTotal) : '0',
          quantityAvailable: stock ? String(stock.quantityAvailable) : '0',
        });
        return;
      }

      if (trackingType === 'bundle') {
        const bundle =
          bundleByKey.get(`${model.id}:${model.lendingLocationId}`) ||
          bundleByKey.get(`${model.id}:global`) ||
          null;
        records.push({
          ...base,
          status: base.isActive === 'true' ? 'active' : 'inactive',
          bundleName: bundle && bundle.name ? bundle.name : model.name,
          bundleDescription: bundle && bundle.description ? bundle.description : (model.description || ''),
          bundleComponents: this.serializeBundleItems(bundle),
        });
        return;
      }

      const assets = Array.isArray(model.assets) ? model.assets : [];
      const filteredAssets = assetActiveFilter === undefined
        ? assets
        : assets.filter((asset) => Boolean(asset.isActive) === assetActiveFilter);

      if (!filteredAssets.length) {
        if (assetActiveFilter !== undefined) {
          return;
        }
        records.push(base);
        return;
      }

      filteredAssets.forEach((asset) => {
        records.push({
          ...base,
          isActive: asset.isActive ? 'true' : 'false',
          inventoryNumber: asset.inventoryNumber || '',
          serialNumber: asset.serialNumber || '',
          status: asset.isActive ? 'active' : 'inactive',
          condition: asset.condition || '',
        });
      });
    });

    return records;
  }

  async exportAssets(filters = {}, format = 'csv') {
    const headers = this.buildCombinedHeaders();
    const records = await this.buildCombinedRecords(filters);
    if (format === 'xlsx') {
      return this.generateExcelBuffer(headers, records, 'Inventory');
    }
    return this.generateCsvBuffer(headers, records);
  }

  async exportModels(filters = {}, format = 'csv') {
    const where = {};
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    const models = await this.models.AssetModel.findAll({
      where,
      include: [
        { model: this.models.Manufacturer, as: 'manufacturer' },
        { model: this.models.AssetCategory, as: 'category' },
      ],
    });

    const headers = this.buildModelExportHeaders();
    const records = this.buildModelRecords(models);

    if (format === 'xlsx') {
      return this.generateExcelBuffer(headers, records, 'Asset Models');
    }
    return this.generateCsvBuffer(headers, records);
  }

  async exportCombined(filters = {}, format = 'csv') {
    const headers = this.buildCombinedHeaders();
    const records = await this.buildCombinedRecords(filters);
    if (format === 'xlsx') {
      return this.generateExcelBuffer(headers, records, 'Export');
    }
    return this.generateCsvBuffer(headers, records);
  }

}

module.exports = CsvExportService;
