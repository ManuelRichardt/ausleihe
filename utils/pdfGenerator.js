const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const PDFDocument = require('pdfkit');

const PAGE = {
  width: 595.28,
  height: 841.89,
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return '';
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '';
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function drawHeader(doc) {
  const headerPath = resolveHeaderImagePath();
  if (headerPath) {
    doc.image(headerPath, 0, 0, { width: PAGE.width, height: 100 });
    return;
  }

  doc.rect(0, 0, PAGE.width, 100).fill('#ECECEC');
  doc.fill('#000000');
  doc.font('Helvetica-Bold').fontSize(20).text('FACHBEREICH', 65, 68);
  doc.font('Helvetica').fontSize(21).text('ANGEWANDTE INFORMATIK', 65, 88);
}

function resolveHeaderImagePath() {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const pngPath = path.join(uploadsDir, 'kopf.png');
  if (fs.existsSync(pngPath)) {
    return pngPath;
  }

  const pdfPath = path.join(uploadsDir, 'kopf.pdf');
  if (!fs.existsSync(pdfPath)) {
    return null;
  }

  const cacheDir = path.join(uploadsDir, '.cache');
  const cachedPngPath = path.join(cacheDir, 'kopf.from-pdf.png');
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    const pdfStat = fs.statSync(pdfPath);
    const pngStat = fs.existsSync(cachedPngPath) ? fs.statSync(cachedPngPath) : null;
    const needsRefresh = !pngStat || pngStat.mtimeMs < pdfStat.mtimeMs;
    if (needsRefresh) {
      execFileSync(
        'sips',
        ['-s', 'format', 'png', '--resampleWidth', '2480', pdfPath, '--out', cachedPngPath],
        { stdio: 'ignore' }
      );
    }
    if (fs.existsSync(cachedPngPath)) {
      return cachedPngPath;
    }
  } catch (err) {
    return null;
  }

  return null;
}

function drawBodyText(doc, returnDate) {
  doc.fill('#000000');
  doc.font('Helvetica-Bold').fontSize(14).text('Ausleihbestätigung:', 65, 119);
  doc.font('Helvetica').fontSize(14).text('Hiermit bestätige ich,', 65, 170);
  doc.text('Name:', 92, 205);
  doc.text('Vorname:', 92, 233);
  doc.text('E-Mail:', 92, 261);

  doc.lineWidth(0.8).strokeColor('#555555').moveTo(225, 223).lineTo(486, 223).stroke();
  doc.moveTo(225, 250).lineTo(486, 250).stroke();
  doc.moveTo(225, 278).lineTo(486, 278).stroke();

  doc
    .font('Helvetica')
    .fontSize(10)
    .text(
      `Die unten aufgeführten Geräte zum ausschließlichen Gebrauch im Rahmen einer Lehrveranstaltung erhalten zu haben. Ich verpflichte mich, die unten genannten Geräte bis spätestens ${returnDate || '__________'} in ordnungsgemäßem Zustand zurückzubringen.`,
      65,
      292,
      { width: 485, align: 'left' }
    )
    .moveDown(0.35)
    .text(
      'Für Schäden durch unsachgemäße oder fahrlässige Bedienung sowie für Verlust übernehme ich die volle Haftung. Weiterhin werde ich von mir festgestellte Mängel bzw. Schäden der entliehenen Geräte sofort einer zuständigen Person des Labors mitteilen.',
      { width: 485, align: 'left' }
    )
    .moveDown(0.35)
    .text(
      'Ich bin mir bewusst, dass ein kommerzieller Einsatz der von mir ausgeliehenen Geräte einer besonderen Absprache bedarf.',
      { width: 485, align: 'left' }
    );
}

function drawUserFields(doc, loan) {
  const user = loan.user || {};
  const lastName = user.lastName || '';
  const firstName = user.firstName || '';
  const email = user.email || '';
  doc.font('Helvetica').fontSize(14).text(lastName, 230, 208, { width: 250 });
  doc.text(firstName, 230, 236, { width: 250 });
  doc.text(email, 230, 264, { width: 250 });
}

function pickLatestSignatureByType(signatures, signatureType) {
  const list = Array.isArray(signatures) ? signatures : [];
  const files = list.filter((entry) => entry && entry.filePath && (!signatureType || entry.signatureType === signatureType));
  if (!files.length) {
    return null;
  }

  const toTimestamp = (entry) => {
    const date =
      toDate(entry.signedAt) ||
      toDate(entry.updatedAt) ||
      toDate(entry.createdAt);
    return date ? date.getTime() : 0;
  };

  files.sort((a, b) => toTimestamp(b) - toTimestamp(a));
  return files[0];
}

function drawSignatureArea(doc, loan) {
  doc.rect(65, 424, 175, 20).fill('#E6E6E6');
  doc.fill('#000000');
  doc.font('Helvetica').fontSize(9).text('Datum, Unterschrift', 65, 447);

  const handoverDateX = 72;
  const handoverSignatureX = 125;
  const handoverSignatureFit = [105, 30];

  const signature = pickLatestSignatureByType(loan.loanSignatures, 'handover');
  if (signature && signature.filePath) {
    try {
      doc.image(signature.filePath, handoverSignatureX, 414, {
        fit: handoverSignatureFit,
        align: 'left',
        valign: 'center',
      });
    } catch (err) {
      doc.font('Helvetica').fontSize(8).text('Signatur konnte nicht geladen werden', handoverSignatureX, 431);
    }
  }

  const signedAt = signature && signature.signedAt ? signature.signedAt : loan.handedOverAt || new Date();
  doc.font('Helvetica').fontSize(9).text(formatDate(signedAt), handoverDateX, 431);
}

function groupModels(loanItems) {
  const groups = new Map();
  (loanItems || []).forEach((item) => {
    if (!item || item.itemType === 'bundle_root') {
      return;
    }
    const model = item.assetModel || (item.asset && item.asset.model) || null;
    const manufacturer = model && model.manufacturer ? `${model.manufacturer.name} ` : '';
    const modelName = model ? model.name : 'Unbekanntes Modell';
    const key = `${manufacturer}${modelName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        modelLabel: `${manufacturer}${modelName}`.trim(),
        quantity: 0,
      });
    }
    const normalizedQuantity = Number.isFinite(Number(item.quantity))
      ? Math.max(parseInt(item.quantity, 10) || 1, 1)
      : 1;
    groups.get(key).quantity += normalizedQuantity;
  });
  return Array.from(groups.values());
}

function drawTable(doc, loan) {
  const startX = 65;
  const startY = 470;
  const rowHeight = 16;
  const rows = 17;
  const widths = [30, 45, 225, 80, 120];

  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const totalHeight = rowHeight * rows;

  doc.rect(startX, startY, totalWidth, totalHeight).strokeColor('#7D7D7D').lineWidth(0.8).stroke();

  let cursorX = startX;
  widths.forEach((width) => {
    cursorX += width;
    doc.moveTo(cursorX, startY).lineTo(cursorX, startY + totalHeight).stroke();
  });

  for (let i = 1; i < rows; i += 1) {
    const y = startY + rowHeight * i;
    doc.moveTo(startX, y).lineTo(startX + totalWidth, y).stroke();
  }

  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Nr', startX + 4, startY + 5, { width: widths[0] - 8 });
  doc.text('Anzahl', startX + widths[0] + 4, startY + 5, { width: widths[1] - 8 });
  doc.text('Modell', startX + widths[0] + widths[1] + 4, startY + 5, { width: widths[2] - 8 });
  doc.text('Rückgabe', startX + widths[0] + widths[1] + widths[2] + 4, startY + 5, {
    width: widths[3] - 8,
  });
  doc.text('Bemerkung', startX + widths[0] + widths[1] + widths[2] + widths[3] + 4, startY + 5, {
    width: widths[4] - 8,
  });

  const grouped = groupModels(loan.loanItems || []);
  doc.font('Helvetica').fontSize(9);
  for (let index = 0; index < 16; index += 1) {
    const y = startY + rowHeight * (index + 1) + 5;
    doc.text(String(index + 1), startX + 4, y, { width: widths[0] - 8 });
    const row = grouped[index];
    if (row) {
      doc.text(String(row.quantity), startX + widths[0] + 4, y, { width: widths[1] - 8 });
      doc.text(row.modelLabel, startX + widths[0] + widths[1] + 4, y, {
        width: widths[2] - 8,
        lineBreak: false,
        ellipsis: true,
      });
    }
  }
}

function drawFooter(doc, loan) {
  const returnSignature = pickLatestSignatureByType(loan.loanSignatures, 'return');
  doc.font('Helvetica').fontSize(11).text('Geräte wurden ordnungsgemäß zurückgegeben.', 65, 764);
  doc.moveTo(362, 772).lineTo(548, 772).strokeColor('#777777').lineWidth(0.8).stroke();

  const returnDateX = 366;
  const returnSignatureX = 430;
  const returnSignatureFit = [112, 26];

  if (returnSignature && returnSignature.filePath) {
    try {
      doc.image(returnSignature.filePath, returnSignatureX, 744, {
        fit: returnSignatureFit,
        align: 'left',
        valign: 'center',
      });
    } catch (err) {
      // ignore image load error in printable output
    }
  }
  const returnDate = returnSignature && returnSignature.signedAt ? returnSignature.signedAt : loan.returnedAt || null;
  if (returnDate) {
    doc.font('Helvetica').fontSize(9).text(formatDate(returnDate), returnDateX, 760);
  }
  doc.font('Helvetica').fontSize(9).text('Datum, Unterschrift (Labor)', 362, 780);
}

async function generateLoanPdf({ loan }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, PAGE.width, PAGE.height).fill('#FFFFFF');
    drawHeader(doc);
    drawBodyText(doc, formatDate(loan.reservedUntil));
    drawUserFields(doc, loan);
    drawSignatureArea(doc, loan);
    drawTable(doc, loan);
    drawFooter(doc, loan);

    doc.end();
  });
}

module.exports = {
  generateLoanPdf,
};
