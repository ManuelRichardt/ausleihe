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

    var scanner = null;
    var scannerRunning = false;
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
      if (!scanner) {
        scannerRunning = false;
        readerEl.innerHTML = '';
        return Promise.resolve();
      }

      var currentScanner = scanner;
      scanner = null;

      var stopPromise = scannerRunning && typeof currentScanner.stop === 'function'
        ? currentScanner.stop().catch(function () {
          // best effort shutdown
        })
        : Promise.resolve();

      return stopPromise.then(function () {
        scannerRunning = false;
        if (typeof currentScanner.clear === 'function') {
          return currentScanner.clear().catch(function () {
            // best effort cleanup
          });
        }
        return null;
      }).finally(function () {
        readerEl.innerHTML = '';
      });
    }

    function startScanner() {
      if (!window.Html5Qrcode) {
        setStatus('html5-qrcode ist nicht geladen. Bitte Seite neu laden.');
        return Promise.resolve();
      }

      return stopScanner().then(function () {
        setStatus('Kamera wird initialisiert …');
        scanner = new window.Html5Qrcode('quickScanReader', { verbose: false });

        return scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 320, height: 180 },
          },
          function onScanSuccess(decodedText) {
            if (typeof activeHandler === 'function') {
              activeHandler(String(decodedText || ''), appendLog);
            }
          },
          function onScanFailure() {
            // ignore per-frame decode failures
          }
        ).then(function () {
          scannerRunning = true;
          setStatus('Scanner aktiv. Barcode im Rahmen ausrichten.');
        }).catch(function () {
          setStatus('Kamera konnte nicht geöffnet werden. Bitte Code manuell eingeben.');
        });
      });
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
