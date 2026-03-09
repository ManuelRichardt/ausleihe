const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const CM_TO_PT = 72 / 2.54;

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

const dataMatrixBufferCache = new Map();
const LABEL_LOGO_PATH = path.resolve(__dirname, '..', 'public', 'images', 'rundlogoSchwarz.png');
let labelLogoBuffer;

function normalizeLabelCode(value) {
  const normalized = String(value == null ? '' : value).trim();
  return normalized || 'UNKNOWN';
}

function normalizeLabelText(value, fallback = '-') {
  const normalized = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function resolveAssetDesignation(asset) {
  const model = asset && asset.model ? asset.model : {};
  return normalizeLabelText(model.name || 'Asset');
}

function getLabelLogoBuffer() {
  if (typeof labelLogoBuffer !== 'undefined') {
    return labelLogoBuffer;
  }
  try {
    labelLogoBuffer = fs.readFileSync(LABEL_LOGO_PATH);
  } catch (err) {
    labelLogoBuffer = null;
  }
  return labelLogoBuffer;
}

function drawLabelLogo(doc, x, y, size) {
  const logoBuffer = getLabelLogoBuffer();
  if (!logoBuffer) {
    return;
  }
  doc.image(logoBuffer, x, y, {
    fit: [size, size],
    align: 'center',
    valign: 'center',
  });
}

function createDataMatrixBuffer(value) {
  const text = normalizeLabelCode(value);
  if (dataMatrixBufferCache.has(text)) {
    return dataMatrixBufferCache.get(text);
  }

  const bufferPromise = new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: 'datamatrix',
        text,
        scale: 3,
        includetext: false,
      },
      (err, png) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(png);
      }
    );
  });

  dataMatrixBufferCache.set(text, bufferPromise);
  return bufferPromise;
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

      const labelWidth = 4.5 * CM_TO_PT;
      const labelHeight = 2 * CM_TO_PT;
      const gapX = 0.2 * CM_TO_PT;
      const gapY = 0.2 * CM_TO_PT;
      const startX = doc.page.margins.left;
      const startY = doc.page.margins.top;
      const printableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const printableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
      const columns = Math.max(1, Math.floor((printableWidth + gapX) / (labelWidth + gapX)));
      const rows = Math.max(1, Math.floor((printableHeight + gapY) / (labelHeight + gapY)));
      const labelsPerPage = columns * rows;
      const locationText = normalizeLabelText(lendingLocationName);

      const renderLabels = async () => {
        for (let index = 0; index < assets.length; index += 1) {
          const asset = assets[index];
          if (index > 0 && index % labelsPerPage === 0) {
            doc.addPage();
          }
          const indexOnPage = index % labelsPerPage;
          const col = indexOnPage % columns;
          const row = Math.floor(indexOnPage / columns);

          const x = startX + (col * (labelWidth + gapX));
          const y = startY + (row * (labelHeight + gapY));
          const model = asset.model || {};
          const inventoryValue = normalizeLabelCode(asset.inventoryNumber || asset.serialNumber || asset.id);
          const manufacturerText = normalizeLabelText(model.manufacturer ? model.manufacturer.name : '-');
          const assetText = resolveAssetDesignation(asset);
          const matrixBuffer = await createDataMatrixBuffer(inventoryValue);

          doc.roundedRect(x, y, labelWidth, labelHeight, 3).strokeColor('#333').lineWidth(0.6).stroke();

          const padding = 2.5;
          const inventoryTextHeight = 8;
          const matrixGap = 2.5;
          const matrixSize = Math.max(20, labelHeight - (2 * padding) - inventoryTextHeight);
          const matrixX = x + padding;
          const matrixY = y + padding;
          const inventoryX = matrixX;
          const inventoryY = y + labelHeight - padding - 6.4;

          const logoSize = 9;
          const logoGap = 2;
          const textX = matrixX + matrixSize + matrixGap;
          const textRightPadding = padding;
          const textWidth = labelWidth - (textX - x) - textRightPadding;
          const headerWidth = Math.max(16, textWidth - logoSize - logoGap);
          const lineStartY = y + padding + 0.6;
          const lineHeight = 8.5;

          doc.font('Helvetica').fontSize(6.2).fillColor('#000').text(locationText, textX, lineStartY, {
            width: headerWidth,
            lineBreak: false,
            ellipsis: true,
          });
          drawLabelLogo(doc, x + labelWidth - textRightPadding - logoSize, lineStartY - 0.5, logoSize);
          doc.font('Helvetica').fontSize(6.2).fillColor('#000').text(manufacturerText, textX, lineStartY + lineHeight, {
            width: textWidth,
            lineBreak: false,
            ellipsis: true,
          });
          doc.font('Helvetica-Bold').fontSize(6.6).fillColor('#111').text(assetText, textX, lineStartY + (2 * lineHeight), {
            width: textWidth,
            lineBreak: false,
            ellipsis: true,
          });
          doc.font('Helvetica-Bold').fontSize(7.0).fillColor('#000').text(inventoryValue, inventoryX, inventoryY, {
            width: matrixSize,
            align: 'center',
            lineBreak: false,
            ellipsis: true,
          });

          doc.image(matrixBuffer, matrixX, matrixY, {
            fit: [matrixSize, matrixSize],
            align: 'center',
            valign: 'center',
          });
        }

        if (!assets.length) {
          doc.font('Helvetica').fontSize(12).text('Keine Assets für Etiketten gefunden.', 36, 50);
        }

        doc.end();
      };

      renderLabels().catch(reject);
    });
  }
}

module.exports = ReportService;
