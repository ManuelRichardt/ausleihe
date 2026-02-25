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

  function highlightRow(row) {
    if (!row) {
      return;
    }
    row.classList.add('table-success');
    setTimeout(function () {
      row.classList.remove('table-success');
    }, 1400);
  }

  function initReturnQuickScan() {
    var checkboxes = Array.from(document.querySelectorAll('.return-item-checkbox'));
    if (!checkboxes.length) {
      return null;
    }

    function collectKnownCodes() {
      return checkboxes
        .map(function (checkbox) {
          var row = checkbox.closest('tr');
          if (!row || !row.children || !row.children[1]) {
            return '';
          }
          return String(row.children[1].textContent || '').trim();
        })
        .filter(Boolean)
        .filter(function (value) {
          return value !== '-';
        });
    }

    function findRowByCode(code) {
      var normalized = normalizeCode(code);
      var normalizedIdentifier = normalizeIdentifier(code);
      for (var i = 0; i < checkboxes.length; i += 1) {
        var checkbox = checkboxes[i];
        var row = checkbox.closest('tr');
        if (!row) {
          continue;
        }
        var inventoryCell = row.children[1];
        if (!inventoryCell) {
          continue;
        }
        var inventoryText = normalizeCode(inventoryCell.textContent);
        var inventoryIdentifier = normalizeIdentifier(inventoryCell.textContent);
        if (
          inventoryText === normalized
          || inventoryText.indexOf(normalized) !== -1
          || normalized.indexOf(inventoryText) !== -1
          || (inventoryIdentifier && normalizedIdentifier && (
            inventoryIdentifier === normalizedIdentifier
            || inventoryIdentifier.indexOf(normalizedIdentifier) !== -1
            || normalizedIdentifier.indexOf(inventoryIdentifier) !== -1
          ))
        ) {
          return row;
        }
      }
      return null;
    }

    return {
      knownCodes: collectKnownCodes(),
      handleCode: function handleCode(code, appendLog) {
        var row = findRowByCode(code);
        if (!row) {
          appendLog('Nicht zugeordnet: ' + code, 'text-danger');
          return;
        }
        var checkbox = row.querySelector('.return-item-checkbox');
        if (checkbox) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change'));
        }
        highlightRow(row);
        appendLog('Markiert: ' + code, 'text-success');
      },
    };
  }

  function initHandoverQuickScan() {
    var selects = Array.from(document.querySelectorAll('#handoverForm select[name$="[assetId]"]'));
    if (!selects.length) {
      return null;
    }

    function collectKnownCodes() {
      var values = [];
      selects.forEach(function (select) {
        Array.from(select.options || []).forEach(function (option) {
          if (!option || !option.value) {
            return;
          }
          var byDataset = option.getAttribute('data-scan-code');
          if (byDataset) {
            values.push(byDataset);
          }
          var byLabel = option.textContent || '';
          if (byLabel) {
            values.push(byLabel);
          }
        });
      });
      return values.filter(Boolean);
    }

    function collectUsedValues() {
      var used = new Set();
      selects.forEach(function (select) {
        if (select.value) {
          used.add(select.value);
        }
      });
      return used;
    }

    function optionMatchesCode(option, normalizedCode) {
      if (!option || !option.value) {
        return false;
      }
      var normalizedIdentifier = normalizeIdentifier(normalizedCode);
      var codeFromDataset = normalizeCode(option.getAttribute('data-scan-code'));
      var labelCode = normalizeCode(option.textContent);
      var datasetIdentifier = normalizeIdentifier(option.getAttribute('data-scan-code'));
      var labelIdentifier = normalizeIdentifier(option.textContent);
      return codeFromDataset === normalizedCode
        || labelCode === normalizedCode
        || labelCode.indexOf(normalizedCode) !== -1
        || normalizedCode.indexOf(codeFromDataset) !== -1
        || (normalizedIdentifier && datasetIdentifier && (
          datasetIdentifier === normalizedIdentifier
          || datasetIdentifier.indexOf(normalizedIdentifier) !== -1
          || normalizedIdentifier.indexOf(datasetIdentifier) !== -1
        ))
        || (normalizedIdentifier && labelIdentifier && (
          labelIdentifier === normalizedIdentifier
          || labelIdentifier.indexOf(normalizedIdentifier) !== -1
          || normalizedIdentifier.indexOf(labelIdentifier) !== -1
        ));
    }

    return {
      knownCodes: collectKnownCodes(),
      handleCode: function handleCode(code, appendLog) {
        var normalizedCode = normalizeCode(code);
        var usedValues = collectUsedValues();
        var matched = null;
        var matchedOption = null;

        for (var i = 0; i < selects.length; i += 1) {
          var select = selects[i];
          for (var j = 0; j < select.options.length; j += 1) {
            var option = select.options[j];
            if (!optionMatchesCode(option, normalizedCode)) {
              continue;
            }
            if (!select.value && !usedValues.has(option.value)) {
              matched = select;
              matchedOption = option;
              break;
            }
            if (select.value === option.value) {
              matched = select;
              matchedOption = option;
              break;
            }
          }
          if (matched) {
            break;
          }
        }

        if (!matched || !matchedOption) {
          appendLog('Nicht zugeordnet: ' + code, 'text-danger');
          return;
        }

        matched.value = matchedOption.value;
        matched.dispatchEvent(new Event('change'));
        var row = matched.closest('tr');
        highlightRow(row);
        appendLog('Zugeteilt: ' + (matchedOption.textContent || code), 'text-success');
      },
    };
  }

  function initQuickScanButtons() {
    var returnScan = initReturnQuickScan();
    var handoverScan = initHandoverQuickScan();

    if (!returnScan && !handoverScan) {
      return;
    }

    var buttons = Array.from(document.querySelectorAll('.js-quickscan-open'));
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        if (!window.QuickScan || typeof window.QuickScan.open !== 'function') {
          alert('Quickscan ist in diesem Browser nicht verfügbar.');
          return;
        }

        var mode = button.getAttribute('data-scan-mode') || '';
        var scanConfig = mode === 'return' ? returnScan : handoverScan;
        if (!scanConfig || typeof scanConfig.handleCode !== 'function') {
          return;
        }
        window.QuickScan.open({
          onCode: scanConfig.handleCode,
          knownCodes: Array.isArray(scanConfig.knownCodes) ? scanConfig.knownCodes : [],
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initQuickScanButtons();
  });
})();
