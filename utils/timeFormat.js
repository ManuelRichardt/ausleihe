function formatTimeHHMM(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (value instanceof Date) {
    const hh = String(value.getHours()).padStart(2, '0');
    const mm = String(value.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const text = String(value).trim();
  const hhmmMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmmMatch) {
    const hh = String(Number(hhmmMatch[1])).padStart(2, '0');
    return `${hh}:${hhmmMatch[2]}`;
  }

  if (text.includes('T')) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      const hh = String(parsed.getHours()).padStart(2, '0');
      const mm = String(parsed.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
  }
  return text;
}

module.exports = {
  formatTimeHHMM,
};
