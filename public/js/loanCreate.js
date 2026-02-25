(function () {
  function normalizeCode(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  function normalizeIdentifier(value) {
    return normalizeCode(value).replace(/[^A-Z0-9]/g, '');
  }

  function buildSearchCandidates(code) {
    var raw = normalizeCode(code);
    var candidates = [];

    function pushCandidate(value) {
      var candidate = String(value || '').trim();
      if (!candidate) {
        return;
      }
      if (candidates.indexOf(candidate) === -1) {
        candidates.push(candidate);
      }
    }

    pushCandidate(raw);

    var identifier = normalizeIdentifier(raw);
    pushCandidate(identifier);

    if (/^[0-9]+$/.test(identifier) && identifier.length >= 5) {
      pushCandidate(identifier.slice(0, -1) + '-' + identifier.slice(-1));
    }

    return candidates;
  }

  function toPositiveInteger(value, fallbackValue) {
    var fallback = Number.isFinite(Number(fallbackValue)) ? parseInt(fallbackValue, 10) : 1;
    if (Number.isNaN(fallback) || fallback < 1) {
      fallback = 1;
    }
    var parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      return fallback;
    }
    return parsed;
  }

  function buildItemKey(entry) {
    if (!entry || typeof entry !== 'object') {
      return '';
    }
    if (entry.kind === 'bulk') {
      return 'bulk:' + String(entry.assetModelId || '');
    }
    return 'serialized:' + String(entry.id || entry.assetId || '');
  }

  function normalizeSelectedEntry(rawEntry) {
    if (!rawEntry) {
      return null;
    }
    var kind = String(rawEntry.kind || rawEntry.trackingType || '').toLowerCase();
    if (kind === 'bulk' || (!rawEntry.assetId && rawEntry.assetModelId)) {
      var bulkModelId = String(rawEntry.assetModelId || rawEntry.modelId || rawEntry.id || '').trim();
      if (!bulkModelId) {
        return null;
      }
      return {
        kind: 'bulk',
        id: bulkModelId,
        assetModelId: bulkModelId,
        inventoryNumber: '',
        serialNumber: '',
        modelName: rawEntry.modelName || rawEntry.name || '',
        manufacturerName: rawEntry.manufacturerName || '',
        quantity: toPositiveInteger(rawEntry.quantity, 1),
        availableQuantity: toPositiveInteger(rawEntry.availableQuantity, 0),
      };
    }

    var assetId = String(rawEntry.id || rawEntry.assetId || '').trim();
    if (!assetId) {
      return null;
    }
    return {
      kind: 'serialized',
      id: assetId,
      assetId: assetId,
      inventoryNumber: rawEntry.inventoryNumber || '',
      serialNumber: rawEntry.serialNumber || '',
      modelName: rawEntry.modelName || '',
      manufacturerName: rawEntry.manufacturerName || '',
      quantity: 1,
    };
  }

  function initBorrowerToggle() {
    var existingRadio = document.getElementById('borrowerTypeExisting');
    var guestRadio = document.getElementById('borrowerTypeGuest');
    var existingBlock = document.getElementById('existingBorrowerBlock');
    var guestBlocks = [
      document.getElementById('guestFirstNameBlock'),
      document.getElementById('guestLastNameBlock'),
      document.getElementById('guestEmailBlock'),
    ];
    if (!existingRadio || !guestRadio || !existingBlock) {
      return function () {};
    }

    function applyMode() {
      var isGuest = Boolean(guestRadio.checked);
      existingBlock.classList.toggle('d-none', isGuest);
      guestBlocks.forEach(function (block) {
        if (block) {
          block.classList.toggle('d-none', !isGuest);
        }
      });
    }

    existingRadio.addEventListener('change', applyMode);
    guestRadio.addEventListener('change', applyMode);
    applyMode();
    return applyMode;
  }

  function parseJsonNode(nodeId) {
    var node = document.getElementById(nodeId);
    if (!node) {
      return [];
    }
    try {
      var parsed = JSON.parse(node.textContent || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function initUserSearch() {
    var input = document.getElementById('borrowerSearch');
    var hidden = document.getElementById('userId');
    var box = document.getElementById('borrowerSuggestions');
    if (!input || !hidden || !box) {
      return;
    }
    var timeoutId = null;

    function closeBox() {
      box.classList.add('d-none');
      box.innerHTML = '';
    }

    function renderSuggestions(items) {
      box.innerHTML = '';
      if (!Array.isArray(items) || !items.length) {
        closeBox();
        return;
      }
      items.forEach(function (item) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'list-group-item list-group-item-action';
        button.textContent = [
          item.label || item.username,
          item.username,
          item.email,
        ].filter(Boolean).join(' — ');
        button.addEventListener('click', function () {
          hidden.value = item.id;
          input.value = button.textContent;
          closeBox();
        });
        box.appendChild(button);
      });
      box.classList.remove('d-none');
    }

    input.addEventListener('input', function () {
      hidden.value = '';
      var q = String(input.value || '').trim();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (q.length < 2) {
        closeBox();
        return;
      }
      timeoutId = setTimeout(function () {
        fetch('/admin/loans/users/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
          .then(function (res) { return res.json(); })
          .then(function (payload) {
            renderSuggestions(payload && payload.data ? payload.data : []);
          })
          .catch(function () {
            closeBox();
          });
      }, 180);
    });

    document.addEventListener('click', function (event) {
      if (!box.contains(event.target) && event.target !== input) {
        closeBox();
      }
    });
  }

  function initAssetSelection() {
    var selectedAssets = parseJsonNode('loanCreateSelectedAssetsSeed')
      .map(normalizeSelectedEntry)
      .filter(Boolean);
    var selectedAssetsInput = document.getElementById('selectedAssetsJson');
    var selectedAssetHiddenInputs = document.getElementById('selectedAssetHiddenInputs');
    var table = document.getElementById('selectedAssetsTable');
    var tbody = table ? table.querySelector('tbody') : null;
    var assetSearchInput = document.getElementById('assetSearch');
    var assetSuggestions = document.getElementById('assetSuggestions');
    var form = document.getElementById('loanCreateForm');
    var knownScanCodes = [];
    var knownScanCodesLoaded = false;
    var knownScanCodesPromise = null;

    if (!selectedAssetsInput || !tbody || !assetSearchInput || !assetSuggestions) {
      return;
    }

    function loadKnownScanCodes() {
      if (knownScanCodesLoaded) {
        return Promise.resolve(knownScanCodes);
      }
      if (knownScanCodesPromise) {
        return knownScanCodesPromise;
      }
      knownScanCodesPromise = fetch('/admin/loans/assets/codes?limit=20000', { credentials: 'same-origin' })
        .then(function (res) { return res.json(); })
        .then(function (payload) {
          var items = payload && Array.isArray(payload.data) ? payload.data : [];
          knownScanCodes = items.filter(Boolean);
          knownScanCodesLoaded = true;
          return knownScanCodes;
        })
        .catch(function () {
          knownScanCodes = [];
          knownScanCodesLoaded = true;
          return knownScanCodes;
        })
        .finally(function () {
          knownScanCodesPromise = null;
        });
      return knownScanCodesPromise;
    }

    function renderHiddenAssetInputs() {
      if (!selectedAssetHiddenInputs) {
        return;
      }
      selectedAssetHiddenInputs.innerHTML = '';
      selectedAssets.forEach(function (entry) {
        if (entry.kind === 'bulk') {
          return;
        }
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'assetIds';
        input.value = entry.id || entry.assetId || '';
        selectedAssetHiddenInputs.appendChild(input);
      });
    }

    function syncHiddenInput() {
      selectedAssetsInput.value = JSON.stringify(selectedAssets.map(function (entry) {
        if (entry.kind === 'bulk') {
          return {
            kind: 'bulk',
            id: entry.id || entry.assetModelId,
            assetModelId: entry.assetModelId || entry.id,
            modelName: entry.modelName || '',
            manufacturerName: entry.manufacturerName || '',
            quantity: toPositiveInteger(entry.quantity, 1),
          };
        }
        return {
          kind: 'serialized',
          assetId: entry.id || entry.assetId,
          id: entry.id || entry.assetId,
          inventoryNumber: entry.inventoryNumber || '',
          serialNumber: entry.serialNumber || '',
          modelName: entry.modelName || '',
          manufacturerName: entry.manufacturerName || '',
        };
      }));
      renderHiddenAssetInputs();
    }

    function syncQuantitiesFromTable() {
      var quantityInputs = tbody ? tbody.querySelectorAll('.js-item-qty') : [];
      Array.prototype.forEach.call(quantityInputs, function (input) {
        var index = parseInt(input.getAttribute('data-index'), 10);
        if (Number.isNaN(index) || index < 0 || index >= selectedAssets.length) {
          return;
        }
        selectedAssets[index].quantity = toPositiveInteger(input.value, selectedAssets[index].quantity || 1);
        input.value = String(selectedAssets[index].quantity);
      });
    }

    function renderRows() {
      tbody.innerHTML = '';
      if (!selectedAssets.length) {
        var emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-row';
        emptyRow.innerHTML = '<td colspan="7" class="text-center text-muted py-3">Noch keine Assets ausgewählt.</td>';
        tbody.appendChild(emptyRow);
        syncHiddenInput();
        return;
      }

      selectedAssets.forEach(function (asset, index) {
        var isBulk = asset.kind === 'bulk';
        var quantityInput = isBulk
          ? '<input type="number" min="1" step="1" class="form-control form-control-sm js-item-qty" data-index="' + index + '" value="' + toPositiveInteger(asset.quantity, 1) + '">'
          : '<span class="badge text-bg-light border">1</span>';
        var row = document.createElement('tr');
        row.dataset.itemKey = buildItemKey(asset);
        row.innerHTML = ''
          + '<td><span class="badge ' + (isBulk ? 'text-bg-warning' : 'text-bg-primary') + '">' + (isBulk ? 'Bulk' : 'Asset') + '</span></td>'
          + '<td>' + (isBulk ? '-' : (asset.inventoryNumber || '-')) + '</td>'
          + '<td>' + (isBulk ? '-' : (asset.serialNumber || '-')) + '</td>'
          + '<td>' + (asset.modelName || '-') + '</td>'
          + '<td>' + (asset.manufacturerName || '-') + '</td>'
          + '<td>' + quantityInput + '</td>'
          + '<td class="text-end">'
          + '  <button type="button" class="btn btn-outline-danger btn-sm remove-asset-button" data-index="' + index + '">'
          + '    <i class="bi bi-trash3-fill"></i>'
          + '  </button>'
          + '</td>';
        tbody.appendChild(row);
      });

      tbody.querySelectorAll('.remove-asset-button').forEach(function (button) {
        button.addEventListener('click', function () {
          var index = parseInt(button.dataset.index, 10);
          if (Number.isNaN(index) || index < 0 || index >= selectedAssets.length) {
            return;
          }
          selectedAssets.splice(index, 1);
          renderRows();
        });
      });

      tbody.querySelectorAll('.js-item-qty').forEach(function (input) {
        var onQuantityChange = function () {
          var index = parseInt(input.getAttribute('data-index'), 10);
          if (Number.isNaN(index) || index < 0 || index >= selectedAssets.length) {
            return;
          }
          selectedAssets[index].quantity = toPositiveInteger(input.value, selectedAssets[index].quantity || 1);
          input.value = String(selectedAssets[index].quantity);
          syncHiddenInput();
        };
        input.addEventListener('change', onQuantityChange);
        input.addEventListener('input', onQuantityChange);
      });

      syncHiddenInput();
    }

    function hasAsset(item) {
      var key = buildItemKey(item);
      if (!key) {
        return false;
      }
      return selectedAssets.some(function (entry) {
        return buildItemKey(entry) === key;
      });
    }

    function addAsset(asset) {
      var normalized = normalizeSelectedEntry(asset);
      if (!normalized || hasAsset(normalized)) {
        return false;
      }
      selectedAssets.push(normalized);
      renderRows();
      return true;
    }

    function closeSuggestions() {
      assetSuggestions.innerHTML = '';
      assetSuggestions.classList.add('d-none');
    }

    function renderAssetSuggestions(items) {
      assetSuggestions.innerHTML = '';
      if (!Array.isArray(items) || !items.length) {
        closeSuggestions();
        return;
      }
      items.forEach(function (item) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'list-group-item list-group-item-action';
        var labelParts = [item.label || [item.inventoryNumber, item.modelName, item.manufacturerName].filter(Boolean).join(' — ')];
        if (item.kind === 'bulk') {
          labelParts.push('Bulk');
        }
        button.textContent = labelParts.filter(Boolean).join(' · ');
        button.addEventListener('click', function () {
          addAsset(item);
          assetSearchInput.value = '';
          closeSuggestions();
        });
        assetSuggestions.appendChild(button);
      });
      assetSuggestions.classList.remove('d-none');
    }

    var assetSearchTimeoutId = null;
    assetSearchInput.addEventListener('input', function () {
      var q = String(assetSearchInput.value || '').trim();
      if (assetSearchTimeoutId) {
        clearTimeout(assetSearchTimeoutId);
      }
      if (q.length < 2) {
        closeSuggestions();
        return;
      }
      assetSearchTimeoutId = setTimeout(function () {
        fetch('/admin/loans/assets/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
          .then(function (res) { return res.json(); })
          .then(function (payload) {
            renderAssetSuggestions(payload && payload.data ? payload.data : []);
          })
          .catch(function () {
            closeSuggestions();
          });
      }, 180);
    });

    document.addEventListener('click', function (event) {
      if (!assetSuggestions.contains(event.target) && event.target !== assetSearchInput) {
        closeSuggestions();
      }
    });

    function handleScannedCode(code, appendLog) {
      var candidates = buildSearchCandidates(code);
      var chain = Promise.resolve(null);

      candidates.forEach(function (candidate) {
        chain = chain.then(function (result) {
          if (result && result.items && result.items.length) {
            return result;
          }
          return fetch('/admin/loans/assets/search?q=' + encodeURIComponent(candidate), { credentials: 'same-origin' })
            .then(function (res) { return res.json(); })
            .then(function (payload) {
              return {
                candidate: candidate,
                items: payload && payload.data ? payload.data : [],
              };
            });
        });
      });

      chain
        .then(function (result) {
          var items = result && Array.isArray(result.items) ? result.items : [];
          if (!items.length) {
            appendLog('Nicht gefunden: ' + code, 'text-danger');
            return;
          }
          var normalized = normalizeCode(code);
          var normalizedIdentifier = normalizeIdentifier(code);
          var exact = items.find(function (item) {
            if (item.kind === 'bulk') {
              return false;
            }
            var inventoryCode = normalizeCode(item.inventoryNumber);
            var serialCode = normalizeCode(item.serialNumber);
            var inventoryIdentifier = normalizeIdentifier(item.inventoryNumber);
            var serialIdentifier = normalizeIdentifier(item.serialNumber);
            return inventoryCode === normalized
              || serialCode === normalized
              || (normalizedIdentifier && (inventoryIdentifier === normalizedIdentifier || serialIdentifier === normalizedIdentifier));
          }) || items.find(function (item) { return item.kind !== 'bulk'; }) || items[0];
          if (addAsset(exact)) {
            appendLog('Hinzugefügt: ' + (exact.inventoryNumber || exact.serialNumber || exact.id), 'text-success');
          } else {
            appendLog('Bereits enthalten: ' + (exact.inventoryNumber || exact.serialNumber || exact.id), 'text-muted');
          }
        })
        .catch(function () {
          appendLog('Scan fehlgeschlagen: ' + code, 'text-danger');
        });
    }

    var quickScanButtons = document.querySelectorAll('.js-quickscan-open[data-scan-mode="create"]');
    quickScanButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        if (!window.QuickScan || typeof window.QuickScan.open !== 'function') {
          alert('Quickscan ist in diesem Browser nicht verfügbar.');
          return;
        }
        loadKnownScanCodes().finally(function () {
          window.QuickScan.open({
            onCode: handleScannedCode,
            knownCodes: knownScanCodes,
          });
        });
      });
    });

    if (form) {
      form.addEventListener('submit', function () {
        syncQuantitiesFromTable();
        syncHiddenInput();
      });
    }

    renderRows();
  }

  function initFormValidation() {
    var form = document.getElementById('loanCreateForm');
    if (!form) {
      return;
    }
    form.addEventListener('submit', function (event) {
      var selectedInput = document.getElementById('selectedAssetsJson');
      var selectedItems = [];
      if (selectedInput && selectedInput.value) {
        try {
          var parsed = JSON.parse(selectedInput.value);
          selectedItems = Array.isArray(parsed) ? parsed : [];
        } catch (err) {
          selectedItems = [];
        }
      }
      if (!selectedItems.length) {
        event.preventDefault();
        alert('Bitte mindestens ein Asset hinzufügen.');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initBorrowerToggle();
    initUserSearch();
    initAssetSelection();
    initFormValidation();
  });
})();
