(function () {
  function parseJSON(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try {
      return JSON.parse(el.textContent || '[]');
    } catch (e) {
      return [];
    }
  }

  function formatDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function formatDateTime(date, time) {
    if (!time) return '';
    return formatDate(date) + 'T' + time.slice(0, 5);
  }

  function buildAvailabilityMap(data) {
    var map = {};
    data.forEach(function (day) {
      map[day.date] = day;
    });
    return map;
  }

  function getMonthGrid(year, month) {
    var first = new Date(year, month, 1);
    var start = new Date(first);
    var day = start.getDay();
    var offset = day === 0 ? -6 : 1 - day; // Monday as first day
    start.setDate(start.getDate() + offset);

    var weeks = [];
    for (var w = 0; w < 6; w += 1) {
      var days = [];
      for (var d = 0; d < 7; d += 1) {
        var cur = new Date(start);
        cur.setDate(start.getDate() + w * 7 + d);
        days.push(cur);
      }
      weeks.push(days);
    }
    return weeks;
  }

  function updateSelectedDisplay(state, availabilityMap) {
    var fromInput = document.getElementById('reservedFrom');
    var untilInput = document.getElementById('reservedUntil');
    var fromDisplay = document.getElementById('selectedFrom');
    var untilDisplay = document.getElementById('selectedUntil');

    if (!state.start || !state.end) {
      fromInput.value = '';
      untilInput.value = '';
      fromDisplay.textContent = '-';
      untilDisplay.textContent = '-';
      return;
    }

    var startKey = formatDate(state.start);
    var endKey = formatDate(state.end);
    var startInfo = availabilityMap[startKey] || {};
    var endInfo = availabilityMap[endKey] || {};

    fromInput.value = formatDateTime(state.start, startInfo.openTime || '08:00');
    untilInput.value = formatDateTime(state.end, endInfo.closeTime || '16:00');
    fromDisplay.textContent = fromInput.value;
    untilDisplay.textContent = untilInput.value;
  }

  function renderCalendar(container, availabilityMap, currentMonth, state) {
    var monthLabel = container.querySelector('[data-calendar-month]');
    var grid = container.querySelector('[data-calendar-grid]');
    var showAvailability = container.getAttribute('data-show-availability') !== 'false';
    if (!monthLabel || !grid) return;

    var monthName = currentMonth.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    monthLabel.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    grid.innerHTML = '';
    var weeks = getMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth());

    weeks.forEach(function (week) {
      var row = document.createElement('tr');
      week.forEach(function (day, idx) {
        var dateKey = formatDate(day);
        var info = availabilityMap[dateKey];
        var isCurrentMonth = day.getMonth() === currentMonth.getMonth();
        var hasPickup = info && (typeof info.hasPickup !== 'undefined' ? info.hasPickup : info.isOpen);
        var hasReturn = info && (typeof info.hasReturn !== 'undefined' ? info.hasReturn : info.isOpen);
        var canSelectStart = Boolean(hasPickup && info.availableCount > 0 && isCurrentMonth);
        var canSelectEnd = Boolean(hasReturn && info.availableCount > 0 && isCurrentMonth);
        var selectingStart = !state.start || state.end;
        var dayIsStartCandidate = selectingStart || (state.start && !state.end && day < state.start);
        var isSelectable = dayIsStartCandidate ? canSelectStart : canSelectEnd;
        var isInRange = state.start && state.end && day >= state.start && day <= state.end;
        var isStart = state.start && formatDate(state.start) === dateKey;
        var isEnd = state.end && formatDate(state.end) === dateKey;


        var cell = document.createElement('td');
        cell.className = 'text-center p-1';

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-sm w-100 ';
        if (isInRange) {
          button.className += 'btn-primary';
        } else if (isSelectable) {
          button.className += 'btn-outline-success';
        } else {
          button.className += 'btn-outline-secondary';
        }
        button.textContent = String(day.getDate());

        if (isStart) {
          button.className += ' rounded-start-pill';
        }
        if (isEnd) {
          button.className += ' rounded-end-pill';
        }

        if (isSelectable) {
          button.addEventListener('click', function () {
            if (!state.start || (state.start && state.end)) {
              state.start = new Date(day);
              state.end = null;
            } else if (day < state.start) {
              state.end = new Date(state.start);
              state.start = new Date(day);
            } else {
              state.end = new Date(day);
            }
            updateSelectedDisplay(state, availabilityMap);
            renderCalendar(container, availabilityMap, currentMonth, state);
          });
        }
        button.disabled = !isSelectable;

        var badge = document.createElement('div');
        badge.className = 'small text-muted';
        if (showAvailability && info && isCurrentMonth) {
          badge.textContent = info.availableCount + '/' + info.totalCount;
        } else {
          badge.textContent = '';
        }

        cell.appendChild(button);
        cell.appendChild(badge);
        row.appendChild(cell);
      });
      grid.appendChild(row);
    });
  }

  function init() {
    var container = document.querySelector('[data-reservation-calendar]');
    if (!container) return;
    var data = parseJSON('availability-data');
    var availabilityMap = buildAvailabilityMap(data);
    var state = { start: null, end: null };
    var currentMonth = new Date();
    currentMonth.setDate(1);

    var prevBtn = container.querySelector('[data-calendar-prev]');
    var nextBtn = container.querySelector('[data-calendar-next]');
    var toggle = document.getElementById('toggleAvailability');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar(container, availabilityMap, currentMonth, state);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar(container, availabilityMap, currentMonth, state);
      });
    }

    if (toggle) {
      toggle.addEventListener('change', function () {
        container.setAttribute('data-show-availability', toggle.checked ? 'true' : 'false');
        renderCalendar(container, availabilityMap, currentMonth, state);
      });
    }

    renderCalendar(container, availabilityMap, currentMonth, state);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
