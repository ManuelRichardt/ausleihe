const {
  BOOLEAN_TRUE_TOKENS,
  BOOLEAN_FALSE_TOKENS,
  ACTIVE_STATUS_LABEL,
} = require('../constants/domain');

const DEFAULT_TRUE_TOKENS = Object.freeze([...BOOLEAN_TRUE_TOKENS]);
const DEFAULT_FALSE_TOKENS = Object.freeze([...BOOLEAN_FALSE_TOKENS]);

function parseBooleanToken(value, options = {}) {
  if (value === undefined || value === null || value === '') {
    return options.defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  const trueTokens = options.trueTokens || DEFAULT_TRUE_TOKENS;
  const falseTokens = options.falseTokens || DEFAULT_FALSE_TOKENS;
  if (trueTokens.includes(normalized)) {
    return true;
  }
  if (falseTokens.includes(normalized)) {
    return false;
  }
  return options.defaultValue;
}

function toActiveStatusLabel(isActive) {
  return isActive ? ACTIVE_STATUS_LABEL.ACTIVE : ACTIVE_STATUS_LABEL.INACTIVE;
}

module.exports = {
  DEFAULT_TRUE_TOKENS,
  DEFAULT_FALSE_TOKENS,
  parseBooleanToken,
  toActiveStatusLabel,
};
