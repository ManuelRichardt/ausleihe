const { Op } = require('sequelize');

function toDateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayOfWeekCode(date) {
  const codes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return codes[date.getDay()];
}

function timeToMinutes(timeValue) {
  if (!timeValue) return null;
  const parts = String(timeValue).split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function dateTimeToMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function resolveWindowForKind(entry, kind) {
  if (kind === 'pickup') {
    return {
      openTime: entry.pickupOpenTime || entry.openTime || null,
      closeTime: entry.pickupCloseTime || entry.closeTime || null,
    };
  }
  if (kind === 'return') {
    return {
      openTime: entry.returnOpenTime || entry.openTime || null,
      closeTime: entry.returnCloseTime || entry.closeTime || null,
    };
  }
  return {
    openTime: entry.openTime || null,
    closeTime: entry.closeTime || null,
  };
}

async function getOpeningWindows(models, lendingLocationId, date, kind = 'general') {
  const dateOnly = toDateOnly(date);
  if (!dateOnly) {
    throw new Error('Invalid date');
  }

  const exception = await models.OpeningException.findOne({
    where: { lendingLocationId, date: dateOnly },
  });
  if (exception) {
    if (exception.isClosed) {
      return [];
    }
    const window = resolveWindowForKind(exception, kind);
    if (!window.openTime || !window.closeTime) {
      return [];
    }
    return [window];
  }

  const dayCode = dayOfWeekCode(new Date(date));
  const regular = await models.OpeningHour.findAll({
    where: {
      lendingLocationId,
      dayOfWeek: dayCode,
      [Op.and]: [
        {
          [Op.or]: [
            { validFrom: null },
            { validFrom: { [Op.lte]: dateOnly } },
          ],
        },
        {
          [Op.or]: [
            { validTo: null },
            { validTo: { [Op.gte]: dateOnly } },
          ],
        },
      ],
    },
  });

  if (!regular || !regular.length) {
    return [];
  }

  return regular
    .filter((entry) => !entry.isClosed)
    .map((entry) => resolveWindowForKind(entry, kind))
    .filter((window) => window.openTime && window.closeTime);
}

function isWithinWindow(date, window) {
  if (!window) return false;
  const openMinutes = timeToMinutes(window.openTime);
  const closeMinutes = timeToMinutes(window.closeTime);
  if (openMinutes === null || closeMinutes === null) return false;
  const valueMinutes = dateTimeToMinutes(date);
  return valueMinutes >= openMinutes && valueMinutes <= closeMinutes;
}

async function assertOpenForRange(models, lendingLocationId, startValue, endValue) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid date range');
  }
  if (end <= start) {
    throw new Error('End date must be after start date');
  }

  const sameDay = toDateOnly(start) === toDateOnly(end);
  const startWindows = await getOpeningWindows(models, lendingLocationId, start, 'pickup');
  if (!startWindows || startWindows.length === 0) {
    throw new Error('Lending location is closed on selected start date');
  }

  if (sameDay) {
    const endWindows = await getOpeningWindows(models, lendingLocationId, end, 'return');
    const fits = startWindows.some((window) => isWithinWindow(start, window)) && endWindows.some((window) => isWithinWindow(end, window));
    if (!fits) {
      throw new Error('Selected time is outside opening hours');
    }
    return true;
  }

  const startFits = startWindows.some((window) => isWithinWindow(start, window));
  if (!startFits) {
    throw new Error('Start time is outside opening hours');
  }

  const endWindows = await getOpeningWindows(models, lendingLocationId, end, 'return');
  if (!endWindows || endWindows.length === 0) {
    throw new Error('Lending location is closed on selected end date');
  }

  const endFits = endWindows.some((window) => isWithinWindow(end, window));
  if (!endFits) {
    throw new Error('End time is outside opening hours');
  }

  return true;
}

async function assertOpenAt(models, lendingLocationId, dateTimeValue, kind = 'general') {
  const dateTime = new Date(dateTimeValue);
  if (Number.isNaN(dateTime.getTime())) {
    throw new Error('Invalid date');
  }
  const windows = await getOpeningWindows(models, lendingLocationId, dateTime, kind);
  if (!windows || windows.length === 0) {
    throw new Error('Lending location is closed on selected date');
  }
  const fits = windows.some((window) => isWithinWindow(dateTime, window));
  if (!fits) {
    throw new Error('Selected time is outside opening hours');
  }
  return true;
}

module.exports = {
  toDateOnly,
  getOpeningWindow: async (...args) => {
    const windows = await getOpeningWindows(...args);
    return windows[0] || null;
  },
  getOpeningWindows,
  assertOpenForRange,
  isWithinWindow,
  assertOpenAt,
  resolveWindowForKind,
};
