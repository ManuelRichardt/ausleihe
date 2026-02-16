const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ATTRIBUTE_REGEX = /\b(?:placeholder|title|aria-label|alt|value|data-bs-title)\s*=\s*["']([^"']+)["']/gi;

function normalizeText(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldIncludeText(value) {
  const lowered = String(value || '').toLowerCase();
  const skipValues = new Set(['true', 'false', 'null', 'undefined', 'on', 'off']);
  if (!value) {
    return false;
  }
  if (value.length < 2) {
    return false;
  }
  if (!/[A-Za-zÄÖÜäöüß]/.test(value)) {
    return false;
  }
  if (/^[\d\s\W_]+$/.test(value)) {
    return false;
  }
  if (value.includes('http://') || value.includes('https://')) {
    return false;
  }
  if (skipValues.has(lowered)) {
    return false;
  }
  if (value.startsWith('/')) {
    return false;
  }
  if (value.startsWith('{') || value.startsWith('[')) {
    return false;
  }
  return true;
}

function toUiTextKey(text) {
  const hash = crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);
  return `auto.${hash}`;
}

function stripEjsBlocks(content) {
  return String(content || '').replace(/<%[\s\S]*?%>/g, ' ');
}

function stripNonTextBlocks(content) {
  return String(content || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
}

function extractCandidatesFromContent(content) {
  const candidates = new Set();
  const stripped = stripEjsBlocks(stripNonTextBlocks(content));

  ATTRIBUTE_REGEX.lastIndex = 0;
  let attrMatch = ATTRIBUTE_REGEX.exec(stripped);
  while (attrMatch) {
    const normalized = normalizeText(attrMatch[1]);
    if (shouldIncludeText(normalized)) {
      candidates.add(normalized);
    }
    attrMatch = ATTRIBUTE_REGEX.exec(stripped);
  }

  const textMatches = stripped.match(/>([^<]+)</g) || [];
  textMatches.forEach((raw) => {
    const normalized = normalizeText(raw.slice(1, -1));
    if (shouldIncludeText(normalized)) {
      candidates.add(normalized);
    }
  });

  return Array.from(candidates);
}

function walkViewFiles(rootDir, acc = []) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkViewFiles(fullPath, acc);
      return;
    }
    if (entry.isFile() && fullPath.endsWith('.ejs')) {
      acc.push(fullPath);
    }
  });
  return acc;
}

function extractUiTextEntriesFromViews(viewsRoot) {
  const files = walkViewFiles(viewsRoot);
  const byKey = new Map();
  files.forEach((filePath) => {
    const relativePath = path.relative(viewsRoot, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    const candidates = extractCandidatesFromContent(content);
    candidates.forEach((text) => {
      const key = toUiTextKey(text);
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          de: text,
          en: text,
          source: relativePath,
        });
      }
    });
  });
  return Array.from(byKey.values());
}

module.exports = {
  extractUiTextEntriesFromViews,
};
