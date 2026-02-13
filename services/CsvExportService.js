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

  async exportAssets(filters = {}, format = 'csv') {
    const query = this.buildAssetExportQuery(filters);
    const instances = await this.models.Asset.findAll(query);
    const customFields = await this.flattenCustomFields(instances);

    const headers = this.buildAssetExportHeaders(customFields);
    const records = this.buildAssetRecords(instances, customFields);

    if (format === 'xlsx') {
      return this.generateExcelBuffer(headers, records, 'Assets');
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
    const assetsQuery = this.buildAssetExportQuery(filters);
    const instances = await this.models.Asset.findAll(assetsQuery);

    const headers = [
      { key: 'manufacturer', header: 'Manufacturer' },
      { key: 'model', header: 'Model' },
      { key: 'category', header: 'Category' },
      { key: 'description', header: 'Description' },
      { key: 'technicalDescription', header: 'TechnicalDescription' },
      { key: 'imageUrl', header: 'ImageURL' },
      { key: 'isActive', header: 'IsActive' },
      { key: 'inventoryNumber', header: 'InventoryNumber' },
      { key: 'serialNumber', header: 'SerialNumber' },
      { key: 'status', header: 'Status' },
      { key: 'condition', header: 'Condition' },
      { key: 'lendingLocation', header: 'LendingLocation' },
    ];

    const assetRecords = instances.map((asset) => {
      const model = asset.model;
      return {
        manufacturer: model && model.manufacturer ? model.manufacturer.name : '',
        model: model ? model.name : '',
        category: model && model.category ? model.category.name : '',
        description: model && model.description ? model.description : '',
        technicalDescription: model && model.technicalDescription ? model.technicalDescription : '',
        imageUrl: model && model.imageUrl ? model.imageUrl : '',
        isActive: asset.isActive ? 'true' : 'false',
        inventoryNumber: asset.inventoryNumber || '',
        serialNumber: asset.serialNumber || '',
        status: asset.isActive ? 'active' : 'inactive',
        condition: asset.condition || '',
        lendingLocation: asset.lendingLocation ? asset.lendingLocation.name : '',
      };
    });

    const records = assetRecords;

    if (format === 'xlsx') {
      return this.generateExcelBuffer(headers, records, 'Export');
    }
    return this.generateCsvBuffer(headers, records);
  }

}

module.exports = CsvExportService;
