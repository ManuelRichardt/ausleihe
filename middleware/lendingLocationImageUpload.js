const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'lending-locations');
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
  if (!file || !file.mimetype || !file.mimetype.startsWith('image/')) {
    return cb(new Error('Nur Bilddateien sind erlaubt'));
  }
  return cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    files: 1,
    fileSize: 15 * 1024 * 1024,
  },
}).single('image');
