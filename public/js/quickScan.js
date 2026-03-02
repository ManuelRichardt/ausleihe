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
    var torchToggleEl = document.getElementById('quickScanTorchToggle');
    var feedbackEl = document.getElementById('quickScanFeedback');

    var html5QrCode = null;
    var activeHandler = function () {};
    var shouldStartOnShow = false;
    var currentCameraId = '';
    var cameraOptions = [];
    var feedbackTimer = null;
    var knownCodeByNormalized = new Map();
    var knownCodeByIdentifier = new Map();
    var voteCounts = new Map();
    var voteOrder = [];
    var maxVoteWindow = 6;
    var lastDeliveredByCode = new Map();
    var lastLogFingerprint = '';
    var lastLogAt = 0;
    var resumeTimer = null;
    var torchSupported = false;
    var torchEnabled = false;
    var scanPauseMs = 700;

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
      var now = Date.now();
      var fingerprint = String(levelClass || '') + '|' + String(message || '');
      if (fingerprint === lastLogFingerprint && now - lastLogAt < 1200) {
        return;
      }
      lastLogFingerprint = fingerprint;
      lastLogAt = now;
      var entry = document.createElement('li');
      entry.className = 'list-group-item py-1 px-2' + (levelClass ? (' ' + levelClass) : '');
      entry.textContent = message;
      logEl.prepend(entry);
      while (logEl.children.length > 12) {
        logEl.removeChild(logEl.lastChild);
      }
    }

    function normalizeCode(value) {
      return String(value || '')
        .trim()
        .replace(/[–—−]/g, '-')
        .replace(/\s+/g, '')
        .toUpperCase();
    }

    function normalizeIdentifier(value) {
      return normalizeCode(value).replace(/[^A-Z0-9]/g, '');
    }

    function normalizeInventoryFormat(value) {
      var normalized = normalizeCode(value);
      if (!normalized) {
        return '';
      }
      var digitsOnly = normalized.replace(/[^0-9]/g, '');
      if (digitsOnly.length === 9) {
        return digitsOnly.slice(0, 8) + '-' + digitsOnly.slice(-1);
      }
      if (/^[0-9]{8}-[0-9]$/.test(normalized)) {
        return normalized;
      }
      return normalized;
    }

    function hasKnownCodeCatalog() {
      return knownCodeByNormalized.size > 0 || knownCodeByIdentifier.size > 0;
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
        var canonical = normalizeInventoryFormat(rawValue);
        if (!canonical || canonical === '-') {
          return;
        }
        if (!knownCodeByNormalized.has(canonical)) {
          knownCodeByNormalized.set(canonical, canonical);
        }
        if (normalized && normalized !== canonical && !knownCodeByNormalized.has(normalized)) {
          knownCodeByNormalized.set(normalized, canonical);
        }
        var identifier = normalizeIdentifier(canonical);
        if (identifier && !knownCodeByIdentifier.has(identifier)) {
          knownCodeByIdentifier.set(identifier, canonical);
        }
        if (normalized) {
          var normalizedIdentifier = normalizeIdentifier(normalized);
          if (normalizedIdentifier && !knownCodeByIdentifier.has(normalizedIdentifier)) {
            knownCodeByIdentifier.set(normalizedIdentifier, canonical);
          }
        }
      });
    }

    function resolveKnownCode(rawValue) {
      var normalizedRaw = normalizeCode(rawValue);
      var normalized = normalizeInventoryFormat(rawValue);
      if (!normalized) {
        return {
          code: null,
          matchedKnown: false,
        };
      }
      if (!hasKnownCodeCatalog()) {
        return {
          code: normalized,
          matchedKnown: false,
        };
      }
      if (knownCodeByNormalized.has(normalized)) {
        return {
          code: knownCodeByNormalized.get(normalized),
          matchedKnown: true,
        };
      }
      if (normalizedRaw && knownCodeByNormalized.has(normalizedRaw)) {
        return {
          code: knownCodeByNormalized.get(normalizedRaw),
          matchedKnown: true,
        };
      }
      var identifier = normalizeIdentifier(normalized);
      if (identifier && knownCodeByIdentifier.has(identifier)) {
        return {
          code: knownCodeByIdentifier.get(identifier),
          matchedKnown: true,
        };
      }
      if (/^[0-9]+$/.test(identifier) && identifier.length >= 5) {
        var withHyphen = identifier.slice(0, -1) + '-' + identifier.slice(-1);
        if (knownCodeByNormalized.has(withHyphen)) {
          return {
            code: knownCodeByNormalized.get(withHyphen),
            matchedKnown: true,
          };
        }
      }
      return {
        code: normalized,
        matchedKnown: false,
      };
    }

    function resetVoteBuffer() {
      voteCounts = new Map();
      voteOrder = [];
    }

    function resolveConfirmedVote(candidateCode, requiredVotes) {
      if (!candidateCode) {
        return null;
      }
      var minimumVotes = Math.max(parseInt(requiredVotes, 10) || 1, 1);
      if (minimumVotes <= 1) {
        resetVoteBuffer();
        return candidateCode;
      }
      voteOrder.push(candidateCode);
      voteCounts.set(candidateCode, (voteCounts.get(candidateCode) || 0) + 1);

      while (voteOrder.length > maxVoteWindow) {
        var removed = voteOrder.shift();
        var nextCount = (voteCounts.get(removed) || 0) - 1;
        if (nextCount > 0) {
          voteCounts.set(removed, nextCount);
        } else {
          voteCounts.delete(removed);
        }
      }

      var bestCode = null;
      var bestCount = 0;
      var secondBestCount = 0;
      voteCounts.forEach(function (count, code) {
        if (count > bestCount) {
          secondBestCount = bestCount;
          bestCount = count;
          bestCode = code;
          return;
        }
        if (count > secondBestCount) {
          secondBestCount = count;
        }
      });

      if (!bestCode) {
        return null;
      }
      if (bestCount < minimumVotes || bestCount <= secondBestCount) {
        return null;
      }

      resetVoteBuffer();
      return bestCode;
    }

    function shouldDeliverCode(code) {
      if (!code) {
        return false;
      }
      var now = Date.now();
      var lastSeenAt = lastDeliveredByCode.get(code) || 0;
      if (now - lastSeenAt < 1800) {
        return false;
      }
      lastDeliveredByCode.set(code, now);
      return true;
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

    function clearResumeTimer() {
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    }

    function updateTorchButton() {
      if (!torchToggleEl) {
        return;
      }
      if (!torchSupported) {
        torchToggleEl.classList.add('d-none');
        torchToggleEl.disabled = true;
        torchToggleEl.setAttribute('aria-pressed', 'false');
        return;
      }
      torchToggleEl.classList.remove('d-none');
      torchToggleEl.disabled = false;
      torchToggleEl.classList.toggle('btn-warning', torchEnabled);
      torchToggleEl.classList.toggle('btn-outline-secondary', !torchEnabled);
      torchToggleEl.textContent = torchEnabled ? 'Licht an' : 'Licht aus';
      torchToggleEl.setAttribute('aria-pressed', torchEnabled ? 'true' : 'false');
    }

    function applyTorchState() {
      if (!torchSupported || !html5QrCode || typeof html5QrCode.applyVideoConstraints !== 'function') {
        return Promise.resolve();
      }
      return Promise.resolve()
        .then(function () {
          return html5QrCode.applyVideoConstraints({ advanced: [{ torch: Boolean(torchEnabled) }] });
        })
        .catch(function () {
          torchEnabled = false;
          updateTorchButton();
        });
    }

    function pauseAfterScanHit() {
      if (!html5QrCode || typeof html5QrCode.pause !== 'function') {
        return;
      }
      clearResumeTimer();
      try {
        html5QrCode.pause(true);
      } catch (err) {
        return;
      }
      resumeTimer = setTimeout(function () {
        resumeTimer = null;
        if (!html5QrCode || typeof html5QrCode.resume !== 'function') {
          return;
        }
        try {
          html5QrCode.resume();
        } catch (err) {
          // best effort
        }
      }, scanPauseMs);
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
      resetKnownCodeLookup();
      resetVoteBuffer();
      lastDeliveredByCode = new Map();
      lastLogFingerprint = '';
      lastLogAt = 0;
      clearResumeTimer();
      torchSupported = false;
      torchEnabled = false;
      updateTorchButton();
      if (manualInputEl) {
        manualInputEl.value = '';
      }
      if (cameraSelectEl) {
        cameraSelectEl.innerHTML = '<option value="">Kamera wird geladen …</option>';
      }
    }

    function stopScanner() {
      clearResumeTimer();
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
          torchSupported = false;
          torchEnabled = false;
          updateTorchButton();
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
      var config = {
        fps: mobile ? 8 : 10,
        disableFlip: true,
        aspectRatio: mobile ? 0.75 : 1.7777777778,
        qrbox: function (viewfinderWidth, viewfinderHeight) {
          var width = Math.max(50, Math.floor(viewfinderWidth * 0.94));
          var height = Math.max(50, Math.floor(viewfinderHeight * 0.72));
          return {
            width: width,
            height: height,
          };
        },
        videoConstraints: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: false,
        },
      };
      if (window.Html5QrcodeSupportedFormats) {
        var formats = window.Html5QrcodeSupportedFormats;
        config.formatsToSupport = [
          formats.CODE_128,
          formats.CODE_39,
          formats.CODE_93,
          formats.CODABAR,
          formats.ITF,
          formats.RSS_14,
          formats.RSS_EXPANDED,
          formats.EAN_13,
          formats.EAN_8,
          formats.UPC_A,
          formats.UPC_E,
          formats.UPC_EAN_EXTENSION,
        ].filter(function (value) {
          return typeof value === 'number';
        });
      }
      return config;
    }

    function tuneRunningCamera() {
      if (!html5QrCode || typeof html5QrCode.applyVideoConstraints !== 'function') {
        torchSupported = false;
        torchEnabled = false;
        updateTorchButton();
        return;
      }
      try {
        var capabilities = typeof html5QrCode.getRunningTrackCapabilities === 'function'
          ? html5QrCode.getRunningTrackCapabilities()
          : null;
        torchSupported = Boolean(capabilities && capabilities.torch);
        if (!torchSupported) {
          torchEnabled = false;
        }
        updateTorchButton();
        var advanced = {};
        if (capabilities && Array.isArray(capabilities.focusMode) && capabilities.focusMode.indexOf('continuous') !== -1) {
          advanced.focusMode = 'continuous';
        }
        var applyPromise = Promise.resolve();
        if (Object.keys(advanced).length) {
          applyPromise = html5QrCode.applyVideoConstraints({ advanced: [advanced] });
        }
        applyPromise
          .catch(function () {
            // best effort only
          })
          .finally(function () {
            void applyTorchState();
          });
      } catch (err) {
        // ignore unsupported capability access
        torchSupported = false;
        torchEnabled = false;
        updateTorchButton();
      }
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
        var cameraInputs = [];
        if (cameraId) {
          cameraInputs.push(cameraId);
          cameraInputs.push({ deviceId: { exact: cameraId } });
        }
        cameraInputs.push({ facingMode: { ideal: 'environment' } });
        cameraInputs.push({ facingMode: 'environment' });
        cameraInputs.push({ facingMode: 'user' });

        var onScanSuccess = function onScanSuccess(decodedText) {
          var resolved = resolveKnownCode(decodedText);
          var resolvedCode = resolved ? normalizeInventoryFormat(resolved.code) : null;
          if (!resolvedCode) {
            return;
          }
          var confirmedCode = resolveConfirmedVote(resolvedCode, 1);
          if (!confirmedCode) {
            return;
          }
          if (!shouldDeliverCode(confirmedCode)) {
            return;
          }
          pauseAfterScanHit();
          flashSuccessFeedback();
          if (typeof activeHandler === 'function') {
            activeHandler(confirmedCode, appendLog);
          }
        };

        function tryStartWithInput(index) {
          if (index >= cameraInputs.length) {
            throw new Error('camera-start-failed');
          }
          return html5QrCode.start(
            cameraInputs[index],
            config,
            onScanSuccess,
            function onScanError() {
              // ignore per-frame decode errors
            }
          ).catch(function () {
            return tryStartWithInput(index + 1);
          });
        }

        return tryStartWithInput(0)
          .then(function () {
            var runningSettings = typeof html5QrCode.getRunningTrackSettings === 'function'
              ? html5QrCode.getRunningTrackSettings()
              : null;
            currentCameraId = runningSettings && runningSettings.deviceId
              ? String(runningSettings.deviceId)
              : (cameraId || '');
            if (cameraSelectEl && currentCameraId) {
              var hasCurrentOption = cameraOptions.some(function (camera) {
                return camera && camera.id === currentCameraId;
              });
              if (hasCurrentOption) {
                cameraSelectEl.value = currentCameraId;
              }
            }
            enforceVideoInlinePlayback();
            tuneRunningCamera();
            setStatus('Scanner aktiv. Barcode in den markierten Bereich halten.');
          })
          .catch(function () {
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
      var normalizedValue = normalizeInventoryFormat(value);
      if (!normalizedValue) {
        return;
      }
      flashSuccessFeedback();
      if (typeof activeHandler === 'function') {
        activeHandler(normalizedValue, appendLog);
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
      buildKnownCodeLookup(config && Array.isArray(config.knownCodes) ? config.knownCodes : []);
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

    if (torchToggleEl) {
      updateTorchButton();
      torchToggleEl.addEventListener('click', function () {
        if (!torchSupported || !html5QrCode) {
          return;
        }
        torchEnabled = !torchEnabled;
        updateTorchButton();
        void applyTorchState();
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
