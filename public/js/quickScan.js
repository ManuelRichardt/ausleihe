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
    var cameraSelectEl = document.getElementById('quickScanCameraSelect');
    var feedbackEl = document.getElementById('quickScanFeedback');

    var html5QrCode = null;
    var activeHandler = function () {};
    var shouldStartOnShow = false;
    var currentCameraId = '';
    var cameraOptions = [];
    var feedbackTimer = null;
    var lastScanValue = '';
    var lastScanAt = 0;

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

    function clearFeedback() {
      if (feedbackTimer) {
        clearTimeout(feedbackTimer);
        feedbackTimer = null;
      }
      if (feedbackEl) {
        feedbackEl.classList.remove('is-success');
      }
    }

    function flashSuccessFeedback() {
      if (!feedbackEl) {
        return;
      }
      clearFeedback();
      feedbackEl.classList.add('is-success');
      feedbackTimer = setTimeout(function () {
        if (feedbackEl) {
          feedbackEl.classList.remove('is-success');
        }
        feedbackTimer = null;
      }, 180);
    }

    function resetState() {
      activeHandler = function () {};
      clearLog();
      clearFeedback();
      currentCameraId = '';
      cameraOptions = [];
      lastScanValue = '';
      lastScanAt = 0;
      if (manualInputEl) {
        manualInputEl.value = '';
      }
      if (cameraSelectEl) {
        cameraSelectEl.innerHTML = '<option value="">Kamera wird geladen …</option>';
      }
    }

    function stopScanner() {
      if (!html5QrCode) {
        readerEl.innerHTML = '';
        return Promise.resolve();
      }
      var instance = html5QrCode;
      html5QrCode = null;
      return Promise.resolve()
        .then(function () {
          if (typeof instance.stop === 'function') {
            return Promise.resolve()
              .then(function () {
                return instance.stop();
              })
              .catch(function () {
                // best effort
              });
          }
          return null;
        })
        .then(function () {
          if (typeof instance.clear === 'function') {
            return Promise.resolve()
              .then(function () {
                return instance.clear();
              })
              .catch(function () {
                // best effort
              });
          }
          return null;
        })
        .finally(function () {
          readerEl.innerHTML = '';
        });
    }

    function enforceVideoInlinePlayback() {
      var videoEl = readerEl ? readerEl.querySelector('video') : null;
      if (!videoEl) {
        return;
      }
      videoEl.setAttribute('playsinline', 'true');
      videoEl.setAttribute('webkit-playsinline', 'true');
      videoEl.setAttribute('autoplay', 'true');
      videoEl.muted = true;
    }

    function isMobileDevice() {
      var ua = String(navigator.userAgent || '').toLowerCase();
      return ua.indexOf('android') !== -1
        || ua.indexOf('iphone') !== -1
        || ua.indexOf('ipad') !== -1
        || ua.indexOf('mobile') !== -1;
    }

    function pickDefaultCameraId(cameras) {
      if (!Array.isArray(cameras) || !cameras.length) {
        return '';
      }
      if (currentCameraId) {
        var keepCurrent = cameras.find(function (cam) { return cam && cam.id === currentCameraId; });
        if (keepCurrent) {
          return keepCurrent.id;
        }
      }

      var mobile = isMobileDevice();
      var preferred = cameras.find(function (cam) {
        var label = String(cam && cam.label ? cam.label : '').toLowerCase();
        return label.indexOf('back') !== -1
          || label.indexOf('rear') !== -1
          || label.indexOf('environment') !== -1;
      });

      if (preferred) {
        return preferred.id;
      }
      if (mobile) {
        return cameras[cameras.length - 1].id;
      }
      return cameras[0].id;
    }

    function renderCameraOptions(cameras, selectedId) {
      if (!cameraSelectEl) {
        return;
      }
      cameraSelectEl.innerHTML = '';

      if (!Array.isArray(cameras) || !cameras.length) {
        var noOption = document.createElement('option');
        noOption.value = '';
        noOption.textContent = 'Keine Kamera gefunden';
        cameraSelectEl.appendChild(noOption);
        cameraSelectEl.disabled = true;
        return;
      }

      cameraSelectEl.disabled = false;
      cameras.forEach(function (camera, index) {
        var option = document.createElement('option');
        option.value = camera.id;
        option.textContent = camera.label || ('Kamera ' + (index + 1));
        option.selected = camera.id === selectedId;
        cameraSelectEl.appendChild(option);
      });
    }

    function buildScannerConfig() {
      var mobile = isMobileDevice();
      return {
        fps: mobile ? 14 : 12,
        aspectRatio: mobile ? 1.3333333333 : 1.7777777778,
        disableFlip: true,
        qrbox: function (viewfinderWidth, viewfinderHeight) {
          var targetWidth = Math.floor(viewfinderWidth * (mobile ? 0.94 : 0.9));
          var targetHeight = Math.floor(viewfinderHeight * (mobile ? 0.38 : 0.34));

          var width = Math.max(160, Math.min(targetWidth, viewfinderWidth - 8));
          var height = Math.max(56, Math.min(targetHeight, viewfinderHeight - 8));
          return {
            width: width,
            height: height,
          };
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };
    }

    function startWithCameraId(cameraId) {
      if (!window.Html5Qrcode) {
        setStatus('html5-qrcode ist nicht geladen. Bitte Seite neu laden.');
        return Promise.resolve();
      }

      return stopScanner().then(function () {
        setStatus('Scanner wird gestartet …');
        html5QrCode = new window.Html5Qrcode('quickScanReader', {
          verbose: false,
        });

        var config = buildScannerConfig();

        return html5QrCode.start(
          cameraId || { facingMode: { ideal: 'environment' } },
          config,
          function onScanSuccess(decodedText) {
            var now = Date.now();
            var value = String(decodedText || '');
            if (value === lastScanValue && now - lastScanAt < 900) {
              return;
            }
            lastScanValue = value;
            lastScanAt = now;
            flashSuccessFeedback();
            if (typeof activeHandler === 'function') {
              activeHandler(value, appendLog);
            }
          },
          function onScanError() {
            // ignore per-frame decode errors
          }
        ).then(function () {
          currentCameraId = cameraId || '';
          enforceVideoInlinePlayback();
          setStatus('Scanner aktiv. Barcode in den markierten Bereich halten.');
        }).catch(function () {
          setStatus('Kamera konnte nicht geöffnet werden. Bitte andere Kamera wählen oder Code manuell eingeben.');
        });
      });
    }

    function loadCameras() {
      if (!window.Html5Qrcode || typeof window.Html5Qrcode.getCameras !== 'function') {
        renderCameraOptions([], '');
        setStatus('Kamera-Liste nicht verfügbar.');
        return Promise.resolve([]);
      }

      return window.Html5Qrcode.getCameras()
        .then(function (cameras) {
          cameraOptions = Array.isArray(cameras) ? cameras : [];
          var defaultId = pickDefaultCameraId(cameraOptions);
          renderCameraOptions(cameraOptions, defaultId);
          return cameraOptions;
        })
        .catch(function () {
          cameraOptions = [];
          renderCameraOptions([], '');
          setStatus('Kameras konnten nicht geladen werden.');
          return [];
        });
    }

    function startScanner() {
      return loadCameras().then(function (cameras) {
        var selectedId = pickDefaultCameraId(cameras);
        if (cameraSelectEl && cameraSelectEl.value) {
          selectedId = cameraSelectEl.value;
        }
        return startWithCameraId(selectedId);
      });
    }

    function handleManualSubmit() {
      var value = manualInputEl ? String(manualInputEl.value || '').trim() : '';
      if (!value) {
        return;
      }
      flashSuccessFeedback();
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
      shouldStartOnShow = true;
      modal.show();
    }

    function close() {
      if (!ensureModalInstance()) {
        return;
      }
      shouldStartOnShow = false;
      modal.hide();
      void stopScanner();
      resetState();
    }

    modalEl.addEventListener('shown.bs.modal', function () {
      if (!shouldStartOnShow) {
        return;
      }
      shouldStartOnShow = false;
      void startScanner();
    });

    modalEl.addEventListener('hidden.bs.modal', function () {
      shouldStartOnShow = false;
      void stopScanner().finally(function () {
        resetState();
      });
    });

    if (cameraSelectEl) {
      cameraSelectEl.addEventListener('change', function () {
        var nextCameraId = String(cameraSelectEl.value || '').trim();
        if (!nextCameraId) {
          return;
        }
        void startWithCameraId(nextCameraId);
      });
    }

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
