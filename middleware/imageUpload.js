const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_ASSET_MODEL_FILES = 40;

const ASSET_MODEL_ALLOWED_EXTENSIONS = Object.freeze({
  images: new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tif', '.tiff', '.heic', '.heif']),
  manuals: new Set([
    '.pdf',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tif', '.tiff',
    '.txt', '.md',
    '.doc', '.docx',
    '.odt',
  ]),
  documents: new Set([
    '.pdf',
    '.txt', '.csv', '.md', '.rtf',
    '.doc', '.docx',
    '.xls', '.xlsx',
    '.ppt', '.pptx',
    '.odt', '.ods', '.odp',
  ]),
});

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
  if (!file) {
    return cb(new Error('Ungültiger Dateityp'));
  }

  const field = file.fieldname;
  const mimetype = String(file.mimetype || '').toLowerCase();
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (field === 'others') {
    return cb(null, true);
  }

  const isImageMime = mimetype.startsWith('image/');
  const isPdfMime = mimetype === 'application/pdf';
  const isTextMime = mimetype.startsWith('text/');
  const isOfficeMime = (
    mimetype.includes('word')
    || mimetype.includes('sheet')
    || mimetype.includes('officedocument')
    || mimetype.includes('presentation')
    || mimetype.includes('powerpoint')
    || mimetype.includes('opendocument')
    || mimetype.includes('rtf')
  );

  const allowedExtensions = ASSET_MODEL_ALLOWED_EXTENSIONS[field];
  const allowedByExtension = Boolean(allowedExtensions && extension && allowedExtensions.has(extension));
  const rejectWithFieldMessage = () => cb(new Error(`Dateityp für Feld "${field}" nicht erlaubt`));

  if (field === 'images') {
    if (isImageMime || allowedByExtension) {
      return cb(null, true);
    }
    return rejectWithFieldMessage();
  }

  if (field === 'manuals') {
    if (isImageMime || isPdfMime || isTextMime || isOfficeMime || allowedByExtension) {
      return cb(null, true);
    }
    return rejectWithFieldMessage();
  }

  if (field === 'documents') {
    if (isPdfMime || isTextMime || isOfficeMime || allowedByExtension) {
      return cb(null, true);
    }
    return rejectWithFieldMessage();
  }

  return rejectWithFieldMessage();
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

const uploadAssetModelImagesHandler = multer({
  storage: createStorage(createUploadDir('asset-models')),
  fileFilter: assetModelFileFilter,
  limits: {
    files: MAX_ASSET_MODEL_FILES,
    fileSize: MAX_FILE_SIZE,
  },
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'manuals', maxCount: 10 },
  { name: 'documents', maxCount: 10 },
  { name: 'others', maxCount: 10 },
]);

function mapAssetModelUploadError(err) {
  if (!err) {
    return 'Upload fehlgeschlagen.';
  }
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return 'Datei zu groß. Maximal 15 MB pro Datei sind erlaubt.';
      case 'LIMIT_FILE_COUNT':
        return `Zu viele Dateien. Maximal ${MAX_ASSET_MODEL_FILES} Dateien pro Upload sind erlaubt.`;
      case 'LIMIT_UNEXPECTED_FILE':
        return `Unerwartetes Upload-Feld: ${err.field || 'unbekannt'}.`;
      default:
        return `Upload fehlgeschlagen (${err.code}).`;
    }
  }
  return err.message || 'Upload fehlgeschlagen.';
}

function uploadAssetModelImages(req, res, next) {
  uploadAssetModelImagesHandler(req, res, (err) => {
    if (!err) {
      return next();
    }

    const message = mapAssetModelUploadError(err);
    const acceptHeader = String(req.get('accept') || '').toLowerCase();
    const isAjax = req.xhr || acceptHeader.includes('application/json');

    if (isAjax) {
      return res.status(422).json({
        data: null,
        error: {
          message,
          code: err.code || 'upload_error',
        },
      });
    }

    if (typeof req.flash === 'function') {
      req.flash('error', message);
    }

    const referer = req.get('referer');
    if (referer) {
      return res.redirect(referer);
    }
    if (req.params && req.params.id) {
      return res.redirect(`/admin/asset-models/${req.params.id}/edit`);
    }
    return res.redirect('/admin/asset-models/new');
  });
}

module.exports = {
  uploadAssetModelImages,
  uploadCategoryImage,
  uploadLendingLocationImage,
};
