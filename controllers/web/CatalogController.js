const { services, renderPage, handleError } = require('./_controllerUtils');

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = {
  mon: 'Montag',
  tue: 'Dienstag',
  wed: 'Mittwoch',
  thu: 'Donnerstag',
  fri: 'Freitag',
  sat: 'Samstag',
  sun: 'Sonntag',
};

function toTime(value) {
  if (!value) {
    return '';
  }
  const text = String(value);
  return text.length >= 5 ? text.slice(0, 5) : text;
}

function openingHourSort(a, b) {
  const left = DAY_ORDER.indexOf(a.dayOfWeek);
  const right = DAY_ORDER.indexOf(b.dayOfWeek);
  return left - right;
}

function mapOpeningHour(hour) {
  return {
    dayCode: hour.dayOfWeek,
    dayLabel: DAY_LABELS[hour.dayOfWeek] || hour.dayOfWeek,
    timeLabel: hour.openTime && hour.closeTime
      ? `${toTime(hour.openTime)} - ${toTime(hour.closeTime)}`
      : '-',
  };
}

function formatDateOnly(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear());
  return `${day}.${month}.${year}`;
}

function addOneDay(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function groupExceptionRanges(exceptions) {
  const sorted = (Array.isArray(exceptions) ? exceptions : [])
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const ranges = [];

  for (const item of sorted) {
    if (!item || !item.date) {
      continue;
    }
    const status = item.isClosed ? 'closed' : 'open';
    const reason = item.reason || null;
    const last = ranges[ranges.length - 1];
    const isContiguous = last && addOneDay(last.dateToRaw) === item.date;
    const hasSameMeta = last && last.status === status && last.reasonRaw === reason;

    if (isContiguous && hasSameMeta) {
      last.dateToRaw = item.date;
      continue;
    }

    ranges.push({
      status,
      reasonRaw: reason,
      reason: reason || '-',
      dateFromRaw: item.date,
      dateToRaw: item.date,
    });
  }

  return ranges.map((range) => ({
    status: range.status,
    reason: range.reason,
    dateFrom: formatDateOnly(range.dateFromRaw),
    dateTo: formatDateOnly(range.dateToRaw),
  }));
}

class CatalogController {
  async lendingLocations(req, res, next) {
    try {
      const locations = await services.lendingLocationService.getAll(
        { isActive: true },
        { order: [['name', 'ASC']] }
      );
      return renderPage(res, 'lending-locations/index', req, {
        breadcrumbs: [{ label: 'Labore', href: '/lending-locations' }],
        locations,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async lendingLocationShow(req, res, next) {
    try {
      const location = await services.lendingLocationService.getById(req.params.id);
      if (!location.isActive) {
        const err = new Error('LendingLocation not found');
        err.status = 404;
        throw err;
      }

      const openingHours = await services.openingHourService.getAll(
        {
          lendingLocationId: location.id,
          isSpecial: false,
        },
        { order: [['dayOfWeek', 'ASC']] }
      );
      const sorted = (openingHours || []).slice().sort(openingHourSort);
      const openDays = sorted.filter((item) => !item.isClosed).map(mapOpeningHour);
      const closedDays = sorted.filter((item) => item.isClosed).map(mapOpeningHour);
      const openingExceptions = await services.openingExceptionService.getAll(
        { lendingLocationId: location.id },
        { order: [['date', 'ASC']] }
      );
      const exceptionRanges = groupExceptionRanges(openingExceptions);

      return renderPage(res, 'lending-locations/show', req, {
        breadcrumbs: [
          { label: 'Labore', href: '/lending-locations' },
          { label: location.name, href: `/lending-locations/${location.id}` },
        ],
        location,
        openDays,
        closedDays,
        exceptionRanges,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async categories(req, res, next) {
    try {
      const categories = await services.assetCategoryService.getAll(
        { isActive: true },
        { order: [['name', 'ASC']] }
      );
      return renderPage(res, 'categories/index', req, {
        breadcrumbs: [{ label: 'Kategorien', href: '/categories' }],
        categories,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = CatalogController;
