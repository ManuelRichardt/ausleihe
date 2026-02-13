const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'asset-models');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${name}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!file || !file.mimetype) {
    return cb(new Error('Ungültiger Dateityp'));
  }
  const field = file.fieldname;
  if (field === 'images' && file.mimetype.startsWith('image/')) {
    return cb(null, true);
  }
  if (field === 'manuals' && (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/'))) {
    return cb(null, true);
  }
  if (field === 'documents' && (
    file.mimetype === 'application/pdf' ||
    file.mimetype.startsWith('text/') ||
    file.mimetype.includes('word') ||
    file.mimetype.includes('sheet') ||
    file.mimetype.includes('officedocument')
  )) {
    return cb(null, true);
  }
  if (field === 'others') {
    return cb(null, true);
  }
  return cb(new Error('Dateityp für dieses Feld nicht erlaubt'));
}

const uploadAssetModelImages = multer({
  storage,
  fileFilter,
  limits: {
    files: 30,
    fileSize: 5 * 1024 * 1024,
  },
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'manuals', maxCount: 10 },
  { name: 'documents', maxCount: 10 },
  { name: 'others', maxCount: 10 },
]);

module.exports = uploadAssetModelImages;
