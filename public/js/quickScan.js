(function () {
  function createQuickScan() {
    var modalEl = document.getElementById('quickScanModal');
    var readerEl = document.getElementById('quickScanReader');
    if (!modalEl || !readerEl) {
      return null;
    }

    var modal = null;
    var statusEl = document.getElementById('quickScanStatus');
    var logEl = document.getElementById('quickScanLog');
    var manualInputEl = document.getElementById('quickScanManualInput');
    var manualAddEl = document.getElementById('quickScanManualAdd');

    var scannerInstance = null;
    var activeHandler = function () {};

    function ensureModalInstance() {
      if (modal) {
        return true;
      }
      if (!window.bootstrap || !window.bootstrap.Modal) {
        return false;
      }
      modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
      return true;
    }

    function setStatus(message) {
      if (statusEl) {
        statusEl.textContent = message;
      }
    }

    function appendLog(message, levelClass) {
      if (!logEl) {
        return;
      }
      var entry = document.createElement('li');
      entry.className = 'list-group-item py-1 px-2' + (levelClass ? (' ' + levelClass) : '');
      entry.textContent = message;
      logEl.prepend(entry);
      while (logEl.children.length > 12) {
        logEl.removeChild(logEl.lastChild);
      }
    }

    function clearLog() {
      if (logEl) {
        logEl.innerHTML = '';
      }
    }

    function resetState() {
      activeHandler = function () {};
      clearLog();
      if (manualInputEl) {
        manualInputEl.value = '';
      }
    }

    function stopScanner() {
      if (!scannerInstance || typeof scannerInstance.clear !== 'function') {
        scannerInstance = null;
        readerEl.innerHTML = '';
        return Promise.resolve();
      }

      var instance = scannerInstance;
      scannerInstance = null;
      return instance.clear().catch(function () {
        // best effort cleanup
      }).finally(function () {
        readerEl.innerHTML = '';
      });
    }

    function startScanner() {
      if (!window.Html5QrcodeScanner) {
        setStatus('html5-qrcode ist nicht geladen. Bitte Seite neu laden.');
        return Promise.resolve();
      }

      return stopScanner().then(function () {
        setStatus('Scanner wird bereitgestellt …');

        var config = {
          fps: 10,
          qrbox: { width: 320, height: 180 },
          rememberLastUsedCamera: true,
        };
        if (window.Html5QrcodeScanType && typeof window.Html5QrcodeScanType.SCAN_TYPE_CAMERA !== 'undefined') {
          config.supportedScanTypes = [window.Html5QrcodeScanType.SCAN_TYPE_CAMERA];
        }

        scannerInstance = new window.Html5QrcodeScanner('quickScanReader', config, false);
        scannerInstance.render(
          function onScanSuccess(decodedText) {
            if (typeof activeHandler === 'function') {
              activeHandler(String(decodedText || ''), appendLog);
            }
          },
          function onScanError() {
            // ignore per-frame decode failures
          }
        );

        setStatus('Scanner aktiv. Kamera auswählen und Scan starten.');
      });
    }

    function handleManualSubmit() {
      var value = manualInputEl ? String(manualInputEl.value || '').trim() : '';
      if (!value) {
        return;
      }
      if (typeof activeHandler === 'function') {
        activeHandler(value, appendLog);
      }
      manualInputEl.value = '';
      manualInputEl.focus();
    }

    function open(config) {
      if (!ensureModalInstance()) {
        return;
      }

      resetState();
      activeHandler = config && typeof config.onCode === 'function'
        ? config.onCode
        : function () {};

      modal.show();
      void startScanner();
    }

    function close() {
      if (!ensureModalInstance()) {
        return;
      }
      modal.hide();
      void stopScanner();
      resetState();
    }

    modalEl.addEventListener('hidden.bs.modal', function () {
      void stopScanner().finally(function () {
        resetState();
      });
    });

    if (manualAddEl && manualInputEl) {
      manualAddEl.addEventListener('click', handleManualSubmit);
      manualInputEl.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') {
          return;
        }
        event.preventDefault();
        handleManualSubmit();
      });
    }

    return {
      open: open,
      close: close,
    };
  }

  window.QuickScan = createQuickScan();
})();
