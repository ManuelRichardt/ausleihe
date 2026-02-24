const PDFDocument = require('pdfkit');
const { Op } = require('sequelize');
const { drawCode128, normalizeCode128Input } = require('../utils/code128');

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

class ReportService {
  constructor(models) {
    this.models = models;
  }

  async getInventoryRows(lendingLocationId, options = {}) {
    const modelWhere = { lendingLocationId };
    if (options.includeInactive === false) {
      modelWhere.isActive = true;
    }

    const models = await this.models.AssetModel.findAll({
      where: modelWhere,
      include: [
        { model: this.models.Manufacturer, as: 'manufacturer' },
        { model: this.models.AssetCategory, as: 'category' },
        {
          model: this.models.Asset,
          as: 'assets',
          required: false,
          include: [{ model: this.models.StorageLocation, as: 'storageLocation', required: false }],
        },
        { model: this.models.InventoryStock, as: 'stocks', required: false },
      ],
      order: [['name', 'ASC']],
    });

    const rows = [];
    models.forEach((model) => {
      const trackingType = model.trackingType || 'serialized';
      const stock = Array.isArray(model.stocks) ? model.stocks[0] : null;
      const assets = Array.isArray(model.assets) ? model.assets : [];
      const baseRow = {
        modelName: model.name,
        manufacturer: model.manufacturer ? model.manufacturer.name : '-',
        category: model.category ? model.category.name : '-',
        trackingType,
      };

      if (trackingType === 'serialized') {
        const assetsWithInventory = assets
          .filter((asset) => String(asset.inventoryNumber || '').trim())
          .sort((a, b) => String(a.inventoryNumber || '').localeCompare(String(b.inventoryNumber || ''), 'de', {
            numeric: true,
            sensitivity: 'base',
          }));

        assetsWithInventory.forEach((asset) => {
          rows.push({
            ...baseRow,
            inventoryOrStock: asset.inventoryNumber,
            storageLocation: asset.storageLocation ? asset.storageLocation.name : '-',
            isActive: Boolean(asset.isActive),
          });
        });

        const missingInventoryCount = assets.length - assetsWithInventory.length;
        if (missingInventoryCount > 0 || assets.length === 0) {
          rows.push({
            ...baseRow,
            inventoryOrStock: assets.length === 0
              ? 'Keine Assets erfasst'
              : `Ohne Inventarnummer: ${missingInventoryCount}`,
            storageLocation: '-',
            isActive: Boolean(model.isActive),
          });
        }
        return;
      }

      if (trackingType === 'bulk') {
        const quantityTotal = stock ? stock.quantityTotal : 0;
        const quantityAvailable = stock ? stock.quantityAvailable : 0;
        rows.push({
          ...baseRow,
          inventoryOrStock: `Gesamt: ${quantityTotal} / Verfügbar: ${quantityAvailable}`,
          storageLocation: '-',
          isActive: Boolean(model.isActive),
        });
        return;
      }

      rows.push({
        ...baseRow,
        inventoryOrStock: `Assets: ${assets.length}`,
        storageLocation: '-',
        isActive: Boolean(model.isActive),
      });
    });
    return rows;
  }

  async getMaintenanceRows(lendingLocationId, filters = {}) {
    const where = {};
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.reportedAt = {};
      if (filters.dateFrom) {
        where.reportedAt[Op.gte] = new Date(`${filters.dateFrom}T00:00:00.000Z`);
      }
      if (filters.dateTo) {
        where.reportedAt[Op.lte] = new Date(`${filters.dateTo}T23:59:59.999Z`);
      }
    }

    return this.models.AssetMaintenance.findAll({
      where,
      include: [
        {
          model: this.models.Asset,
          as: 'asset',
          where: { lendingLocationId },
          required: true,
          include: [
            {
              model: this.models.AssetModel,
              as: 'model',
              include: [{ model: this.models.Manufacturer, as: 'manufacturer' }],
            },
          ],
        },
      ],
      order: [['reportedAt', 'DESC']],
    });
  }

  async getLabelAssets(lendingLocationId, filters = {}) {
    const where = { lendingLocationId };
    if (filters.onlyActive) {
      where.isActive = true;
    }
    if (filters.query) {
      const q = `%${String(filters.query).trim()}%`;
      where[Op.or] = [
        { inventoryNumber: { [Op.like]: q } },
        { serialNumber: { [Op.like]: q } },
      ];
    }
    return this.models.Asset.findAll({
      where,
      include: [
        {
          model: this.models.AssetModel,
          as: 'model',
          include: [{ model: this.models.Manufacturer, as: 'manufacturer' }],
        },
      ],
      order: [['inventoryNumber', 'ASC']],
      limit: 500,
    });
  }

  generateInventoryPdf({ lendingLocationName, rows }) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.font('Helvetica-Bold').fontSize(16).text('Inventurliste');
      doc.font('Helvetica').fontSize(10).fillColor('#444').text(`Ausleihe: ${lendingLocationName || '-'}`);
      doc.text(`Erstellt: ${formatDateTime(new Date())}`);
      doc.moveDown(1);

      const widths = [188, 108, 118, 68, 145, 96, 46];
      const startX = doc.x;
      let cursorY = doc.y;
      const headers = ['Modell', 'Hersteller', 'Kategorie', 'Typ', 'Inventar / Bestand', 'Lagerort', 'Aktiv'];

      const tableWidth = widths.reduce((sum, item) => sum + item, 0);
      const drawTableHeader = () => {
        doc.font('Helvetica-Bold').fontSize(9);
        let x = startX;
        headers.forEach((header, idx) => {
          doc.text(header, x, cursorY, { width: widths[idx], continued: false });
          x += widths[idx];
        });
        cursorY += 16;
        doc.moveTo(startX, cursorY - 2).lineTo(startX + tableWidth, cursorY - 2).stroke();
      };

      drawTableHeader();

      doc.font('Helvetica').fontSize(9);
      rows.forEach((row) => {
        if (cursorY > doc.page.height - 50) {
          doc.addPage();
          cursorY = 36;
          drawTableHeader();
          doc.font('Helvetica').fontSize(9);
        }
        const values = [
          row.modelName || '-',
          row.manufacturer || '-',
          row.category || '-',
          row.trackingType || 'serialized',
          row.inventoryOrStock || '-',
          row.storageLocation || '-',
          row.isActive ? 'Ja' : 'Nein',
        ];
        let colX = startX;
        values.forEach((value, idx) => {
          doc.text(String(value), colX, cursorY, {
            width: widths[idx],
            lineBreak: false,
            ellipsis: true,
          });
          colX += widths[idx];
        });
        cursorY += 14;
      });

      doc.end();
    });
  }

  generateMaintenancePdf({ lendingLocationName, rows }) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.font('Helvetica-Bold').fontSize(16).text('Wartungsbericht');
      doc.font('Helvetica').fontSize(10).fillColor('#444').text(`Ausleihe: ${lendingLocationName || '-'}`);
      doc.text(`Erstellt: ${formatDateTime(new Date())}`);
      doc.moveDown(1);

      const widths = [110, 90, 90, 70, 80, 120];
      const headers = ['Meldung', 'Asset', 'Modell', 'Status', 'Abgeschlossen', 'Notiz'];
      const startX = doc.x;
      let cursorY = doc.y;

      doc.font('Helvetica-Bold').fontSize(9);
      let x = startX;
      headers.forEach((header, idx) => {
        doc.text(header, x, cursorY, { width: widths[idx], continued: false });
        x += widths[idx];
      });
      cursorY += 16;
      doc.moveTo(startX, cursorY - 2).lineTo(startX + widths.reduce((sum, item) => sum + item, 0), cursorY - 2).stroke();

      doc.font('Helvetica').fontSize(9);
      rows.forEach((entry) => {
        if (cursorY > doc.page.height - 50) {
          doc.addPage();
          cursorY = 36;
        }
        const asset = entry.asset || {};
        const model = asset.model || {};
        const values = [
          formatDateTime(entry.reportedAt),
          asset.inventoryNumber || '-',
          model.name || '-',
          entry.status || '-',
          entry.completedAt ? formatDateTime(entry.completedAt) : '-',
          (entry.notes || '').replace(/\s+/g, ' ').trim() || '-',
        ];

        let colX = startX;
        values.forEach((value, idx) => {
          doc.text(String(value), colX, cursorY, {
            width: widths[idx],
            lineBreak: false,
            ellipsis: true,
          });
          colX += widths[idx];
        });
        cursorY += 14;
      });

      doc.end();
    });
  }

  generateLabelsPdf({ lendingLocationName, assets }) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 18 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const labelWidth = 270;
      const labelHeight = 90;
      const gapX = 12;
      const gapY = 10;
      const startX = 18;
      const startY = 30;

      assets.forEach((asset, index) => {
        const col = index % 2;
        const row = Math.floor((index % 14) / 2);
        const pageIndex = Math.floor(index / 14);
        if (index > 0 && index % 14 === 0) {
          doc.addPage();
        }

        const x = startX + (col * (labelWidth + gapX));
        const y = startY + (row * (labelHeight + gapY));

        doc.rect(x, y, labelWidth, labelHeight).strokeColor('#333').lineWidth(0.8).stroke();
        const model = asset.model || {};
        const manufacturer = model.manufacturer ? model.manufacturer.name : '';
        const barcodeValue = normalizeCode128Input(asset.inventoryNumber || asset.serialNumber || asset.id);

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(model.name || 'Asset', x + 8, y + 6, {
          width: labelWidth - 16,
          lineBreak: false,
          ellipsis: true,
        });
        doc.font('Helvetica').fontSize(8).fillColor('#222').text(manufacturer || '-', x + 8, y + 20, {
          width: labelWidth - 16,
          lineBreak: false,
          ellipsis: true,
        });
        doc.font('Helvetica').fontSize(8).fillColor('#222').text(`Inv: ${asset.inventoryNumber || '-'}`, x + 8, y + 32);
        if (lendingLocationName) {
          doc.text(lendingLocationName, x + 8, y + 42, {
            width: labelWidth - 16,
            lineBreak: false,
            ellipsis: true,
          });
        }

        const barcodeX = x + 10;
        const barcodeY = y + 54;
        const barcodeWidth = labelWidth - 20;
        const barcodeHeight = 22;
        drawCode128(doc, barcodeValue, barcodeX, barcodeY, barcodeWidth, barcodeHeight);
        doc.font('Helvetica').fontSize(8).fillColor('#000').text(barcodeValue, barcodeX, barcodeY + barcodeHeight + 2, {
          width: barcodeWidth,
          align: 'center',
          lineBreak: false,
        });
        if (pageIndex > 0 && col === 0 && row === 0) {
          doc.font('Helvetica').fontSize(7).fillColor('#666').text(`Seite ${pageIndex + 1}`, 18, 12);
        }
      });

      if (!assets.length) {
        doc.font('Helvetica').fontSize(12).text('Keine Assets für Etiketten gefunden.', 36, 50);
      }

      doc.end();
    });
  }
}

module.exports = ReportService;
