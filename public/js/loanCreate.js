(function () {
  function normalizeCode(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
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
    var selectedAssets = parseJsonNode('loanCreateSelectedAssetsSeed');
    var selectedAssetsInput = document.getElementById('selectedAssetsJson');
    var selectedAssetHiddenInputs = document.getElementById('selectedAssetHiddenInputs');
    var table = document.getElementById('selectedAssetsTable');
    var tbody = table ? table.querySelector('tbody') : null;
    var assetSearchInput = document.getElementById('assetSearch');
    var assetSuggestions = document.getElementById('assetSuggestions');

    if (!selectedAssetsInput || !tbody || !assetSearchInput || !assetSuggestions) {
      return;
    }

    function renderHiddenAssetInputs() {
      if (!selectedAssetHiddenInputs) {
        return;
      }
      selectedAssetHiddenInputs.innerHTML = '';
      selectedAssets.forEach(function (entry) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'assetIds';
        input.value = entry.id || entry.assetId || '';
        selectedAssetHiddenInputs.appendChild(input);
      });
    }

    function syncHiddenInput() {
      selectedAssetsInput.value = JSON.stringify(selectedAssets.map(function (entry) {
        return {
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

    function renderRows() {
      tbody.innerHTML = '';
      if (!selectedAssets.length) {
        var emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-row';
        emptyRow.innerHTML = '<td colspan="5" class="text-center text-muted py-3">Noch keine Assets ausgewählt.</td>';
        tbody.appendChild(emptyRow);
        syncHiddenInput();
        return;
      }

      selectedAssets.forEach(function (asset, index) {
        var row = document.createElement('tr');
        row.dataset.assetId = asset.id || asset.assetId;
        row.innerHTML = ''
          + '<td>' + (asset.inventoryNumber || '-') + '</td>'
          + '<td>' + (asset.serialNumber || '-') + '</td>'
          + '<td>' + (asset.modelName || '-') + '</td>'
          + '<td>' + (asset.manufacturerName || '-') + '</td>'
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

      syncHiddenInput();
    }

    function hasAsset(assetId) {
      return selectedAssets.some(function (entry) {
        return (entry.id || entry.assetId) === assetId;
      });
    }

    function addAsset(asset) {
      var assetId = asset && (asset.id || asset.assetId);
      if (!assetId || hasAsset(assetId)) {
        return false;
      }
      selectedAssets.push({
        id: assetId,
        inventoryNumber: asset.inventoryNumber || '',
        serialNumber: asset.serialNumber || '',
        modelName: asset.modelName || '',
        manufacturerName: asset.manufacturerName || '',
      });
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
        button.textContent = item.label || [item.inventoryNumber, item.modelName, item.manufacturerName].filter(Boolean).join(' — ');
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
      fetch('/admin/loans/assets/search?q=' + encodeURIComponent(code), { credentials: 'same-origin' })
        .then(function (res) { return res.json(); })
        .then(function (payload) {
          var items = payload && payload.data ? payload.data : [];
          if (!items.length) {
            appendLog('Nicht gefunden: ' + code, 'text-danger');
            return;
          }
          var normalized = normalizeCode(code);
          var exact = items.find(function (item) {
            return normalizeCode(item.inventoryNumber) === normalized
              || normalizeCode(item.serialNumber) === normalized;
          }) || items[0];
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
        window.QuickScan.open({
          onCode: handleScannedCode,
        });
      });
    });

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
