const DEFAULT_ITEM_QUANTITY = 1;

function parsePositiveQuantity(value, fallback = DEFAULT_ITEM_QUANTITY) {
  const fallbackValue = Number.isInteger(fallback) && fallback > 0
    ? fallback
    : DEFAULT_ITEM_QUANTITY;
  const raw = value === undefined || value === null || value === ''
    ? fallbackValue
    : value;
  const parsedQuantity = parseInt(raw, 10);
  if (Number.isNaN(parsedQuantity)) {
    return fallbackValue;
  }
  return Math.max(parsedQuantity, DEFAULT_ITEM_QUANTITY);
}

module.exports = {
  DEFAULT_ITEM_QUANTITY,
  parsePositiveQuantity,
};
