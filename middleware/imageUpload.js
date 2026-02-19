const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const MAX_FILE_SIZE = 15 * 1024 * 1024;

function createUploadDir(subDirectory) {
  const uploadDir = path.join(__dirname, '..', 'public', 'uploads', subDirectory);
  fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
}

function createStorage(uploadDir) {
  return multer.diskStorage({
    destination(req, file, cb) {
      cb(null, uploadDir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const name = crypto.randomBytes(16).toString('hex');
      cb(null, `${name}${ext}`);
    },
  });
}

function imageOnlyFilter(req, file, cb) {
  if (!file || !file.mimetype || !file.mimetype.startsWith('image/')) {
    return cb(new Error('Nur Bilddateien sind erlaubt'));
  }
  return cb(null, true);
}

function assetModelFileFilter(req, file, cb) {
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

function createSingleImageUpload(subDirectory) {
  return multer({
    storage: createStorage(createUploadDir(subDirectory)),
    fileFilter: imageOnlyFilter,
    limits: {
      files: 1,
      fileSize: MAX_FILE_SIZE,
    },
  }).single('image');
}

const uploadCategoryImage = createSingleImageUpload('categories');
const uploadLendingLocationImage = createSingleImageUpload('lending-locations');

const uploadAssetModelImages = multer({
  storage: createStorage(createUploadDir('asset-models')),
  fileFilter: assetModelFileFilter,
  limits: {
    files: 30,
    fileSize: MAX_FILE_SIZE,
  },
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'manuals', maxCount: 10 },
  { name: 'documents', maxCount: 10 },
  { name: 'others', maxCount: 10 },
]);

module.exports = {
  uploadAssetModelImages,
  uploadCategoryImage,
  uploadLendingLocationImage,
};
