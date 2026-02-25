(function () {
  function normalizeCode(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  function createQuickScan() {
    var modalEl = document.getElementById('quickScanModal');
    if (!modalEl) {
      return null;
    }

    var modal = null;
    var videoEl = document.getElementById('quickScanVideo');
    var statusEl = document.getElementById('quickScanStatus');
    var logEl = document.getElementById('quickScanLog');
    var manualInputEl = document.getElementById('quickScanManualInput');
    var manualAddEl = document.getElementById('quickScanManualAdd');

    var stream = null;
    var detector = null;
    var loopTimer = null;
    var activeHandler = null;
    var lastSeen = new Map();
    var throttleMs = 1200;

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

    function stopLoop() {
      if (loopTimer) {
        clearTimeout(loopTimer);
        loopTimer = null;
      }
    }

    function stopCamera() {
      stopLoop();
      if (videoEl) {
        videoEl.pause();
        videoEl.srcObject = null;
      }
      if (stream) {
        stream.getTracks().forEach(function (track) {
          track.stop();
        });
      }
      stream = null;
    }

    function shouldAccept(code) {
      var normalized = normalizeCode(code);
      if (!normalized) {
        return false;
      }
      var now = Date.now();
      var last = lastSeen.get(normalized) || 0;
      if (now - last < throttleMs) {
        return false;
      }
      lastSeen.set(normalized, now);
      return true;
    }

    function handleCode(code) {
      var normalized = normalizeCode(code);
      if (!normalized) {
        return;
      }
      if (!shouldAccept(normalized)) {
        return;
      }
      if (typeof activeHandler === 'function') {
        activeHandler(normalized, appendLog);
      }
    }

    function scanLoop() {
      if (!detector || !videoEl || !stream) {
        return;
      }
      detector.detect(videoEl)
        .then(function (barcodes) {
          if (Array.isArray(barcodes)) {
            barcodes.forEach(function (barcode) {
              if (barcode && barcode.rawValue) {
                handleCode(barcode.rawValue);
              }
            });
          }
        })
        .catch(function () {
          // scanner errors are non-fatal in loop
        })
        .finally(function () {
          loopTimer = setTimeout(scanLoop, 180);
        });
    }

    function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('Kamera nicht verfügbar. Bitte Code manuell eingeben.');
        return Promise.resolve();
      }
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
        },
      }).then(function (mediaStream) {
        stream = mediaStream;
        if (videoEl) {
          videoEl.srcObject = stream;
          return videoEl.play();
        }
        return null;
      }).then(function () {
        if (window.BarcodeDetector) {
          return window.BarcodeDetector.getSupportedFormats()
            .then(function (supportedFormats) {
              var preferredFormats = ['code_128', 'qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e'];
              var formats = preferredFormats.filter(function (entry) {
                return supportedFormats.indexOf(entry) !== -1;
              });
              detector = new window.BarcodeDetector({ formats: formats.length ? formats : undefined });
              setStatus('Scanner aktiv. Mehrere Labels nacheinander scannen.');
              scanLoop();
            })
            .catch(function () {
              setStatus('Barcode-Scanner nicht verfügbar. Bitte Code manuell eingeben.');
            });
        }
        setStatus('Barcode-Scanner nicht verfügbar. Bitte Code manuell eingeben.');
        return null;
      }).catch(function () {
        setStatus('Kamera konnte nicht geöffnet werden. Bitte Code manuell eingeben.');
      });
    }

    function resetState() {
      activeHandler = null;
      detector = null;
      lastSeen = new Map();
      if (logEl) {
        logEl.innerHTML = '';
      }
      if (manualInputEl) {
        manualInputEl.value = '';
      }
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
      startCamera();
    }

    function close() {
      if (!ensureModalInstance()) {
        return;
      }
      modal.hide();
      stopCamera();
      resetState();
    }

    modalEl.addEventListener('hidden.bs.modal', function () {
      stopCamera();
      resetState();
    });

    if (manualAddEl && manualInputEl) {
      manualAddEl.addEventListener('click', function () {
        handleCode(manualInputEl.value);
        manualInputEl.value = '';
        manualInputEl.focus();
      });
      manualInputEl.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') {
          return;
        }
        event.preventDefault();
        handleCode(manualInputEl.value);
        manualInputEl.value = '';
      });
    }

    return {
      open: open,
      close: close,
      normalizeCode: normalizeCode,
    };
  }

  window.QuickScan = createQuickScan();
})();
