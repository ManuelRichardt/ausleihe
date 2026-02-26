const validator = require('validator');

function sanitizeValue(value, key) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (key && /password/i.test(key)) {
      return trimmed;
    }
    if (key && /email/i.test(key)) {
      return validator.normalizeEmail(trimmed) || trimmed;
    }
    if (key && /username/i.test(key)) {
      return trimmed;
    }
    if (key && /(url|website)/i.test(key)) {
      return trimmed;
    }
    return validator.escape(trimmed);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key));
  }
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).forEach((key) => {
      if (
        key === 'specs' ||
        key === 'enumValues' ||
        key === 'customFields' ||
        key === 'userFilter' ||
        key === 'userDnTemplate' ||
        key === 'baseDn' ||
        key === 'attrExternalId' ||
        key === 'attrGroups' ||
        key === 'attrDisplayName' ||
        key === 'attrFirstName' ||
        key === 'attrLastName' ||
        key === 'attrUsername' ||
        key === 'attrEmail' ||
        key === 'roleMapJson' ||
        key === 'spEntityId' ||
        key === 'idpEntityId' ||
        key === 'nameIdFormat' ||
        key === 'next' ||
        key === 'returnTo' ||
        key === 'csrfToken' ||
        key === 'signatureBase64' ||
        key === 'signatureData' ||
        key === 'selectedAssetsJson'
      ) {
        result[key] = value[key];
        return;
      }
      result[key] = sanitizeValue(value[key], key);
    });
    return result;
  }
  return value;
}

module.exports = function sanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
    if (req.body.email) {
      req.body.email = validator.normalizeEmail(req.body.email) || req.body.email;
    }
    if (req.body.supportEmail) {
      req.body.supportEmail = validator.normalizeEmail(req.body.supportEmail) || req.body.supportEmail;
    }
  }
  next();
};
