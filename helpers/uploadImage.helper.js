const fs = require('fs');
const path = require('path');

function toPublicUploadUrl(file, folder) {
  if (!file || !file.filename) {
    return null;
  }
  return `/uploads/${folder}/${file.filename}`;
}

function removePublicFileByUrl(url) {
  if (!url || /^https?:\/\//i.test(url)) {
    return;
  }
  const normalized = String(url).replace(/^\/?public\//, '/');
  if (!normalized.startsWith('/uploads/')) {
    return;
  }
  const relativePath = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  const publicRoot = path.join(process.cwd(), 'public');
  const filePath = path.resolve(publicRoot, relativePath);
  if (!filePath.startsWith(publicRoot)) {
    return;
  }
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    // best-effort cleanup only
  }
}

module.exports = {
  toPublicUploadUrl,
  removePublicFileByUrl,
};
