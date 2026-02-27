(function () {
  var HTML5_QRCODE_SCRIPT_SOURCES = [
    '/vendor/html5-qrcode/html5-qrcode.min.js',
    '/vendor/html5-qrcode/minified/html5-qrcode.min.js',
    '/vendor/html5-qrcode/dist/html5-qrcode.min.js',
  ];
  var SCAN_THROTTLE_MS = 1200;
  var html5QrcodeLoadPromise = null;

  function normalizeCode(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  function normalizeIdentifier(value) {
    return normalizeCode(value).replace(/[^A-Z0-9]/g, '');
  }

  function isPlausibleScannedCode(normalizedCode) {
    if (!normalizedCode || normalizedCode.length < 3 || normalizedCode.length > 64) {
      return false;
    }
    if (!/^[A-Z0-9-]+$/.test(normalizedCode)) {
      return false;
    }
    var digitMatches = normalizedCode.match(/[0-9]/g);
    return Boolean(digitMatches && digitMatches.length >= 2);
  }

  function loadHtml5QrcodeScript() {
    if (window.Html5Qrcode) {
      return Promise.resolve();
    }
    if (html5QrcodeLoadPromise) {
      return html5QrcodeLoadPromise;
    }

    function loadSource(index) {
      if (index >= HTML5_QRCODE_SCRIPT_SOURCES.length) {
        return Promise.reject(new Error('html5-qrcode-load-failed'));
      }

      var source = HTML5_QRCODE_SCRIPT_SOURCES[index];
      var selector = 'script[data-html5-qrcode-source="' + source + '"]';
      var existingScript = document.querySelector(selector);
      var existingState = existingScript ? existingScript.getAttribute('data-html5-qrcode-state') : '';
      if (existingScript && (window.Html5Qrcode || existingState === 'loaded')) {
        return Promise.resolve();
      }
      if (existingScript && existingState === 'error') {
        return loadSource(index + 1);
      }

      return new Promise(function (resolve, reject) {
        var script = existingScript || document.createElement('script');
        if (!existingScript) {
          script.src = source;
          script.async = true;
          script.defer = true;
          script.setAttribute('data-html5-qrcode-source', source);
          script.setAttribute('data-html5-qrcode-state', 'loading');
          document.head.appendChild(script);
        }

        script.addEventListener('load', function () {
          script.setAttribute('data-html5-qrcode-state', 'loaded');
          if (window.Html5Qrcode) {
            resolve();
            return;
          }
          reject(new Error('html5-qrcode-load-failed'));
        }, { once: true });

        script.addEventListener('error', function () {
          script.setAttribute('data-html5-qrcode-state', 'error');
          reject(new Error('html5-qrcode-load-failed'));
        }, { once: true });
      }).catch(function () {
        return loadSource(index + 1);
      });
    }

    html5QrcodeLoadPromise = loadSource(0).finally(function () {
      html5QrcodeLoadPromise = null;
    });
    return html5QrcodeLoadPromise;
  }

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
    var startPromise = null;
    var activeHandler = null;
    var openToken = 0;
    var lastSeen = new Map();
    var knownCodeByNormalized = new Map();
    var knownCodeByIdentifier = new Map();

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

    function resetKnownCodeLookup() {
      knownCodeByNormalized = new Map();
      knownCodeByIdentifier = new Map();
    }

    function buildKnownCodeLookup(values) {
      resetKnownCodeLookup();
      if (!Array.isArray(values)) {
        return;
      }
      values.forEach(function (rawValue) {
        var normalized = normalizeCode(rawValue);
        if (!normalized || normalized === '-') {
          return;
        }
        if (!knownCodeByNormalized.has(normalized)) {
          knownCodeByNormalized.set(normalized, normalized);
        }
        var identifier = normalizeIdentifier(normalized);
        if (identifier && !knownCodeByIdentifier.has(identifier)) {
          knownCodeByIdentifier.set(identifier, normalized);
        }
      });
    }

    function hasKnownCodeCatalog() {
      return knownCodeByNormalized.size > 0 || knownCodeByIdentifier.size > 0;
    }

    function resolveKnownCode(normalizedCode) {
      if (!hasKnownCodeCatalog()) {
        return normalizedCode;
      }
      if (knownCodeByNormalized.has(normalizedCode)) {
        return knownCodeByNormalized.get(normalizedCode);
      }

      var identifier = normalizeIdentifier(normalizedCode);
      if (identifier && knownCodeByIdentifier.has(identifier)) {
        return knownCodeByIdentifier.get(identifier);
      }

      if (/^[0-9]+$/.test(identifier) && identifier.length >= 5) {
        var withHyphen = identifier.slice(0, -1) + '-' + identifier.slice(-1);
        if (knownCodeByNormalized.has(withHyphen)) {
          return knownCodeByNormalized.get(withHyphen);
        }
      }

      return null;
    }

    function shouldAccept(code) {
      var normalized = normalizeCode(code);
      if (!normalized) {
        return false;
      }
      var now = Date.now();
      var last = lastSeen.get(normalized) || 0;
      if (now - last < SCAN_THROTTLE_MS) {
        return false;
      }
      lastSeen.set(normalized, now);
      return true;
    }

    function handleCode(rawCode) {
      var normalized = normalizeCode(rawCode);
      if (!normalized) {
        return;
      }

      var resolvedCode = resolveKnownCode(normalized);
      if (!resolvedCode) {
        return;
      }
      if (!isPlausibleScannedCode(resolvedCode)) {
        return;
      }
      if (!shouldAccept(resolvedCode)) {
        return;
      }

      if (typeof activeHandler === 'function') {
        activeHandler(resolvedCode, appendLog);
      }
    }

    function getFormatSupportList() {
      var formats = window.Html5QrcodeSupportedFormats || {};
      var entries = [
        formats.CODE_128,
        formats.CODE_39,
        formats.CODABAR,
        formats.ITF,
        formats.QR_CODE,
        formats.EAN_13,
        formats.EAN_8,
        formats.UPC_A,
        formats.UPC_E,
        formats.DATA_MATRIX,
      ].filter(function (value) {
        return typeof value !== 'undefined';
      });
      return entries.length ? entries : null;
    }

    function createScannerInstance() {
      var formats = getFormatSupportList();
      var config = { verbose: false };
      if (formats) {
        config.formatsToSupport = formats;
      }
      return new window.Html5Qrcode('quickScanReader', config);
    }

    function getStartConfig() {
      return {
        fps: 10,
        aspectRatio: 1.7777777778,
        disableFlip: false,
        qrbox: function (viewfinderWidth, viewfinderHeight) {
          var width = Math.max(140, Math.floor(viewfinderWidth * 0.86));
          var height = Math.max(100, Math.floor(viewfinderHeight * 0.56));
          return {
            width: Math.min(width, viewfinderWidth),
            height: Math.min(height, viewfinderHeight),
          };
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };
    }

    function startWithCameraConfigs(cameraConfigs, index, sessionToken) {
      if (!scanner) {
        return Promise.reject(new Error('scanner-missing'));
      }
      if (!Array.isArray(cameraConfigs) || index >= cameraConfigs.length) {
        return Promise.reject(new Error('camera-config-exhausted'));
      }

      return scanner.start(
        cameraConfigs[index],
        getStartConfig(),
        function (decodedText) {
          handleCode(decodedText);
        },
        function () {
          // decoding failures are expected while scanning continuously
        }
      ).then(function () {
        if (sessionToken !== openToken) {
          return stopScanner();
        }
        scannerRunning = true;
        setStatus('Scanner aktiv. Barcode im Rahmen ausrichten und kurz ruhig halten.');
        return null;
      }).catch(function () {
        return startWithCameraConfigs(cameraConfigs, index + 1, sessionToken);
      });
    }

    function startWithEnumeratedCameras(sessionToken) {
      if (!window.Html5Qrcode || typeof window.Html5Qrcode.getCameras !== 'function') {
        return Promise.reject(new Error('camera-list-not-available'));
      }
      if (!scanner) {
        return Promise.reject(new Error('scanner-missing'));
      }

      return window.Html5Qrcode.getCameras().then(function (cameras) {
        if (!Array.isArray(cameras) || !cameras.length) {
          throw new Error('no-cameras-found');
        }

        var preferred = cameras.find(function (camera) {
          var label = String(camera && camera.label ? camera.label : '').toLowerCase();
          return label.indexOf('back') !== -1
            || label.indexOf('rear') !== -1
            || label.indexOf('environment') !== -1;
        }) || cameras[0];

        return scanner.start(
          preferred.id,
          getStartConfig(),
          function (decodedText) {
            handleCode(decodedText);
          },
          function () {
            // decoding failures are expected while scanning continuously
          }
        );
      }).then(function () {
        if (sessionToken !== openToken) {
          return stopScanner();
        }
        scannerRunning = true;
        setStatus('Scanner aktiv. Barcode im Rahmen ausrichten und kurz ruhig halten.');
        return null;
      });
    }

    function startScanner(sessionToken) {
      if (startPromise) {
        return startPromise;
      }

      setStatus('Kamera wird initialisiert …');
      startPromise = loadHtml5QrcodeScript()
        .then(function () {
          if (!window.Html5Qrcode) {
            throw new Error('html5-qrcode-not-available');
          }

          return stopScanner().finally(function () {
            scanner = createScannerInstance();
          });
        })
        .then(function () {
          var cameraConfigs = [
            { facingMode: { exact: 'environment' } },
            { facingMode: { ideal: 'environment' } },
            { facingMode: 'environment' },
          ];
          return startWithCameraConfigs(cameraConfigs, 0, sessionToken)
            .catch(function () {
              return startWithEnumeratedCameras(sessionToken);
            });
        })
        .catch(function () {
          setStatus('Kamera konnte nicht geöffnet werden. Bitte Code manuell eingeben.');
        })
        .finally(function () {
          startPromise = null;
        });

      return startPromise;
    }

    function stopScanner() {
      if (!scanner) {
        scannerRunning = false;
        return Promise.resolve();
      }

      var currentScanner = scanner;
      scanner = null;
      var stopPromise = scannerRunning && typeof currentScanner.stop === 'function'
        ? currentScanner.stop().catch(function () {
          // best effort
        })
        : Promise.resolve();

      return stopPromise.then(function () {
        scannerRunning = false;
        if (typeof currentScanner.clear === 'function') {
          return currentScanner.clear().catch(function () {
            // best effort
          });
        }
        return null;
      });
    }

    function resetState() {
      activeHandler = null;
      lastSeen = new Map();
      resetKnownCodeLookup();
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
      openToken += 1;
      var sessionToken = openToken;
      activeHandler = config && typeof config.onCode === 'function'
        ? config.onCode
        : function () {};

      buildKnownCodeLookup(config && Array.isArray(config.knownCodes) ? config.knownCodes : []);
      modal.show();
      startScanner(sessionToken);
    }

    function close() {
      if (!ensureModalInstance()) {
        return;
      }
      openToken += 1;
      modal.hide();
      void stopScanner();
      resetState();
    }

    modalEl.addEventListener('hidden.bs.modal', function () {
      openToken += 1;
      void stopScanner().finally(function () {
        resetState();
      });
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
