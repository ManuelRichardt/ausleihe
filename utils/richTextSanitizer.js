const sanitizeHtml = require('sanitize-html');

const RICH_TEXT_SANITIZE_OPTIONS = Object.freeze({
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    'b',
    'i',
    'ul',
    'ol',
    'li',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'h3',
    'h4',
    'h5',
    'h6',
  ],
  allowedAttributes: {
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
});

function normalizeRichTextInput(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const sanitized = sanitizeHtml(raw, RICH_TEXT_SANITIZE_OPTIONS).trim();
  return sanitized || null;
}

module.exports = {
  normalizeRichTextInput,
  RICH_TEXT_SANITIZE_OPTIONS,
};
