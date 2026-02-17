(function () {
  const input = document.getElementById('privacyUserSearchInput');
  const hiddenUserId = document.getElementById('privacyDeletionUserId');
  const results = document.getElementById('privacyUserSearchResults');
  const selectedLabel = document.getElementById('privacyUserSelectedLabel');
  const form = document.getElementById('privacyDeletionRequestForm');

  if (!input || !hiddenUserId || !results || !selectedLabel || !form) {
    return;
  }

  let searchTimer = null;
  let currentAbort = null;
  let selectedUser = null;
  let lastResultsById = new Map();

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildUserLabel(user) {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    if (fullName) {
      return `${fullName} (${user.username})`;
    }
    return user.username || user.email || user.id;
  }

  function resetSelection() {
    selectedUser = null;
    hiddenUserId.value = '';
    selectedLabel.textContent = 'Kein Benutzer ausgewählt.';
  }

  function selectUser(user) {
    selectedUser = user;
    hiddenUserId.value = user.id;
    input.value = buildUserLabel(user);
    selectedLabel.textContent = `Ausgewählt: ${buildUserLabel(user)}${user.email ? ` · ${user.email}` : ''}`;
    results.classList.add('d-none');
    results.innerHTML = '';
  }

  function hideResults() {
    results.classList.add('d-none');
    results.innerHTML = '';
  }

  function renderResults(items) {
    lastResultsById = new Map();
    if (!Array.isArray(items) || items.length === 0) {
      results.innerHTML = '<div class="list-group-item text-muted small">Keine Treffer</div>';
      results.classList.remove('d-none');
      return;
    }
    items.forEach((item) => {
      if (item && item.id) {
        lastResultsById.set(String(item.id), item);
      }
    });

    results.innerHTML = items
      .map((user) => {
        const title = buildUserLabel(user);
        const subtitle = [user.email, user.id].filter(Boolean).join(' · ');
        return (
          `<button type="button" class="list-group-item list-group-item-action" data-user-id="${escapeHtml(user.id)}">` +
          `<div class="fw-semibold">${escapeHtml(title)}</div>` +
          `<div class="small text-muted">${escapeHtml(subtitle)}</div>` +
          '</button>'
        );
      })
      .join('');
    results.classList.remove('d-none');
  }

  async function searchUsers(query) {
    if (currentAbort) {
      currentAbort.abort();
      currentAbort = null;
    }
    currentAbort = new AbortController();

    try {
      const response = await fetch(`/system/privacy/users/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: currentAbort.signal,
      });
      if (!response.ok) {
        hideResults();
        return;
      }
      const payload = await response.json();
      renderResults(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return;
      }
      hideResults();
    }
  }

  input.addEventListener('input', function () {
    if (selectedUser && hiddenUserId.value && input.value !== buildUserLabel(selectedUser)) {
      resetSelection();
    }
    const q = String(input.value || '').trim();
    if (q.length < 2) {
      hideResults();
      return;
    }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      searchUsers(q);
    }, 220);
  });

  results.addEventListener('click', function (event) {
    const target = event.target.closest('[data-user-id]');
    if (!target) {
      return;
    }
    const userId = target.getAttribute('data-user-id');
    if (!userId) {
      return;
    }
    const user = lastResultsById.get(String(userId));
    if (user) {
      selectUser(user);
    }
  });

  document.addEventListener('click', function (event) {
    if (event.target === input || results.contains(event.target)) {
      return;
    }
    hideResults();
  });

  form.addEventListener('submit', function (event) {
    if (!hiddenUserId.value) {
      event.preventDefault();
      selectedLabel.textContent = 'Bitte wählen Sie einen Benutzer aus der Trefferliste aus.';
      selectedLabel.classList.add('text-danger');
      input.focus();
    } else {
      selectedLabel.classList.remove('text-danger');
    }
  });
})();
