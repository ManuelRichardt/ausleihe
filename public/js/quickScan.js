(function () {
  var CODE128_PATTERNS = [
    '11011001100', '11001101100', '11001100110', '10010011000', '10010001100', '10001001100', '10011001000',
    '10011000100', '10001100100', '11001001000', '11001000100', '11000100100', '10110011100', '10011011100',
    '10011001110', '10111001100', '10011101100', '10011100110', '11001110010', '11001011100', '11001001110',
    '11011100100', '11001110100', '11101101110', '11101001100', '11100101100', '11100100110', '11101100100',
    '11100110100', '11100110010', '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
    '10001000110', '10110001000', '10001101000', '10001100010', '11010001000', '11000101000', '11000100010',
    '10110111000', '10110001110', '10001101110', '10111011000', '10111000110', '10001110110', '11101110110',
    '11010001110', '11000101110', '11011101000', '11011100010', '11011101110', '11101011000', '11101000110',
    '11100010110', '11101101000', '11101100010', '11100011010', '11101111010', '11001000010', '11110001010',
    '10100110000', '10100001100', '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
    '10110000100', '10011010000', '10011000010', '10000110100', '10000110010', '11000010010', '11001010000',
    '11110111010', '11000010100', '10001111010', '10100111100', '10010111100', '10010011110', '10111100100',
    '10011110100', '10011110010', '11110100100', '11110010100', '11110010010', '11011011110', '11011110110',
    '11110110110', '10101111000', '10100011110', '10001011110', '10111101000', '10111100010', '11110101000',
    '11110100010', '10111011110', '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
    '11010011100', '1100011101011',
  ];

  var CODE128_START_A = 103;
  var CODE128_START_B = 104;
  var CODE128_START_C = 105;
  var CODE128_STOP = 106;
  var CODE128_DATA_MAX = 95;
  var CODE128_NORMAL_MATCH_THRESHOLD = 0.34;
  var CODE128_STOP_MATCH_THRESHOLD = 0.38;
  var FALLBACK_SCAN_INTERVAL_MS = 220;
  var DETECTOR_SCAN_INTERVAL_MS = 180;

  var CODE128_SYMBOLS = (function buildCode128Symbols() {
    return CODE128_PATTERNS.map(function (pattern, code) {
      var runs = [];
      var current = pattern.charAt(0);
      var runLength = 1;
      for (var i = 1; i < pattern.length; i += 1) {
        if (pattern.charAt(i) === current) {
          runLength += 1;
          continue;
        }
        runs.push(runLength);
        current = pattern.charAt(i);
        runLength = 1;
      }
      runs.push(runLength);
      return {
        code: code,
        pattern: pattern,
        modules: pattern.length,
        runs: runs,
      };
    });
  })();

  function normalizeCode(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  function isPlausibleScannedCode(normalizedCode) {
    if (!normalizedCode || normalizedCode.length < 4 || normalizedCode.length > 48) {
      return false;
    }
    if (!/^[A-Z0-9-]+$/.test(normalizedCode)) {
      return false;
    }
    var digitMatches = normalizedCode.match(/[0-9]/g);
    return Boolean(digitMatches && digitMatches.length >= 1);
  }

  function normalizeCode128Input(value) {
    return String(value || '')
      .split('')
      .map(function (char) {
        var code = char.charCodeAt(0);
        if (code >= 32 && code <= 126) {
          return char;
        }
        return ' ';
      })
      .join('')
      .trim();
  }

  function encodeCode128BPattern(value) {
    var input = normalizeCode128Input(value);
    if (!input) {
      return '';
    }
    var codes = [];
    for (var i = 0; i < input.length; i += 1) {
      codes.push(input.charCodeAt(i) - 32);
    }

    var checksum = CODE128_START_B;
    for (var c = 0; c < codes.length; c += 1) {
      checksum += codes[c] * (c + 1);
    }
    var checkCode = checksum % 103;
    var sequence = [CODE128_START_B].concat(codes).concat([checkCode, CODE128_STOP]);
    var pattern = '';
    for (var s = 0; s < sequence.length; s += 1) {
      pattern += CODE128_PATTERNS[sequence[s]];
    }
    return pattern;
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function patternToRuns(pattern) {
    if (!pattern) {
      return [];
    }
    var runs = [];
    var current = pattern.charAt(0);
    var runLength = 1;
    for (var i = 1; i < pattern.length; i += 1) {
      if (pattern.charAt(i) === current) {
        runLength += 1;
        continue;
      }
      runs.push(runLength);
      current = pattern.charAt(i);
      runLength = 1;
    }
    runs.push(runLength);
    return runs;
  }

  function buildKnownCode128Candidates(values) {
    if (!Array.isArray(values)) {
      return [];
    }
    var seen = new Set();
    var candidates = [];
    values.forEach(function (rawValue) {
      var normalized = normalizeCode(rawValue);
      if (!normalized || normalized === '-' || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      var pattern = encodeCode128BPattern(normalized);
      if (!pattern) {
        return;
      }
      candidates.push({
        raw: rawValue,
        normalized: normalized,
        pattern: pattern,
        runs: patternToRuns(pattern),
        modules: pattern.length,
      });
    });
    return candidates;
  }

  function safeMinMax(line) {
    var min = 255;
    var max = 0;
    for (var i = 0; i < line.length; i += 1) {
      if (line[i] < min) {
        min = line[i];
      }
      if (line[i] > max) {
        max = line[i];
      }
    }
    return { min: min, max: max };
  }

  function luminanceFromImageData(imageData, x, y) {
    var index = ((y * imageData.width) + x) * 4;
    var data = imageData.data;
    return (0.299 * data[index]) + (0.587 * data[index + 1]) + (0.114 * data[index + 2]);
  }

  function buildHorizontalLine(imageData, y) {
    var row = new Array(imageData.width);
    for (var x = 0; x < imageData.width; x += 1) {
      row[x] = luminanceFromImageData(imageData, x, y);
    }
    return row;
  }

  function buildVerticalLine(imageData, x) {
    var column = new Array(imageData.height);
    for (var y = 0; y < imageData.height; y += 1) {
      column[y] = luminanceFromImageData(imageData, x, y);
    }
    return column;
  }

  function scoreLineTransitions(line) {
    if (!Array.isArray(line) || line.length < 40) {
      return 0;
    }
    var minMax = safeMinMax(line);
    var contrast = minMax.max - minMax.min;
    if (contrast < 28) {
      return 0;
    }
    var threshold = minMax.min + (contrast * 0.5);
    var previous = line[0] <= threshold ? 1 : 0;
    var transitions = 0;
    for (var i = 1; i < line.length; i += 1) {
      var current = line[i] <= threshold ? 1 : 0;
      if (current !== previous) {
        transitions += 1;
      }
      previous = current;
    }
    return transitions;
  }

  function collectHighTransitionRows(imageData, maxRows) {
    if (!imageData || !imageData.width || !imageData.height) {
      return [];
    }
    var rows = [];
    var step = Math.max(1, Math.floor(imageData.height / 72));
    for (var y = 0; y < imageData.height; y += step) {
      var line = buildHorizontalLine(imageData, y);
      var score = scoreLineTransitions(line);
      if (!score) {
        continue;
      }
      rows.push({ y: y, score: score });
    }

    rows.sort(function (a, b) {
      return b.score - a.score;
    });

    var unique = [];
    var minDistance = Math.max(4, Math.floor(imageData.height / 40));
    for (var i = 0; i < rows.length && unique.length < maxRows; i += 1) {
      var candidate = rows[i];
      var tooClose = unique.some(function (picked) {
        return Math.abs(picked - candidate.y) < minDistance;
      });
      if (!tooClose) {
        unique.push(candidate.y);
      }
    }
    return unique;
  }

  function smoothBinary(binary) {
    for (var i = 1; i < binary.length - 1; i += 1) {
      if (binary[i - 1] === binary[i + 1] && binary[i] !== binary[i - 1]) {
        binary[i] = binary[i - 1];
      }
    }
  }

  function buildRuns(binary, fromIndex, toIndex) {
    var runs = [];
    var colors = [];
    if (fromIndex >= toIndex) {
      return { runs: runs, colors: colors };
    }

    var current = binary[fromIndex];
    var runLength = 1;
    for (var i = fromIndex + 1; i <= toIndex; i += 1) {
      if (binary[i] === current) {
        runLength += 1;
        continue;
      }
      colors.push(current);
      runs.push(runLength);
      current = binary[i];
      runLength = 1;
    }
    colors.push(current);
    runs.push(runLength);
    return { runs: runs, colors: colors };
  }

  function collapseTinyRuns(runData) {
    var runs = runData.runs;
    var colors = runData.colors;
    if (runs.length < 7) {
      return runData;
    }

    var total = 0;
    for (var i = 0; i < runs.length; i += 1) {
      total += runs[i];
    }
    var average = total / runs.length;
    var tinyThreshold = Math.max(1, Math.floor(average * 0.14));
    var changed = true;

    while (changed && runs.length >= 7) {
      changed = false;

      if (runs.length > 1 && runs[0] <= tinyThreshold) {
        runs[1] += runs[0];
        runs.shift();
        colors.shift();
        changed = true;
      }

      if (runs.length > 1 && runs[runs.length - 1] <= tinyThreshold) {
        runs[runs.length - 2] += runs[runs.length - 1];
        runs.pop();
        colors.pop();
        changed = true;
      }

      for (var idx = 1; idx < runs.length - 1; idx += 1) {
        if (runs[idx] > tinyThreshold) {
          continue;
        }
        runs[idx - 1] += runs[idx] + runs[idx + 1];
        runs.splice(idx, 2);
        colors.splice(idx, 2);
        changed = true;
        break;
      }
    }
    return { runs: runs, colors: colors };
  }

  function buildRunDataFromLine(line) {
    if (!Array.isArray(line) || line.length < 80) {
      return null;
    }

    var minMax = safeMinMax(line);
    if ((minMax.max - minMax.min) < 40) {
      return null;
    }
    var threshold = minMax.min + ((minMax.max - minMax.min) * 0.5);

    var binary = new Uint8Array(line.length);
    for (var i = 0; i < line.length; i += 1) {
      binary[i] = line[i] <= threshold ? 1 : 0;
    }
    smoothBinary(binary);

    var firstBlack = 0;
    while (firstBlack < binary.length && binary[firstBlack] === 0) {
      firstBlack += 1;
    }
    if (firstBlack >= binary.length) {
      return null;
    }
    var lastBlack = binary.length - 1;
    while (lastBlack >= 0 && binary[lastBlack] === 0) {
      lastBlack -= 1;
    }
    if ((lastBlack - firstBlack) < 50) {
      return null;
    }

    var runData = buildRuns(binary, firstBlack, lastBlack);
    if (!runData.runs.length) {
      return null;
    }
    return collapseTinyRuns(runData);
  }

  function scoreCandidateRuns(observedRuns, candidateRuns, candidateModules) {
    if (!Array.isArray(observedRuns) || !Array.isArray(candidateRuns) || observedRuns.length !== candidateRuns.length) {
      return Number.POSITIVE_INFINITY;
    }

    var observedSum = 0;
    for (var i = 0; i < observedRuns.length; i += 1) {
      observedSum += observedRuns[i];
    }
    if (!observedSum || !candidateModules) {
      return Number.POSITIVE_INFINITY;
    }

    var scale = observedSum / candidateModules;
    var error = 0;
    for (var r = 0; r < observedRuns.length; r += 1) {
      error += Math.abs(observedRuns[r] - (candidateRuns[r] * scale));
    }
    return error / observedSum;
  }

  function matchKnownCode128CandidatesFromRunData(runData, knownCandidates) {
    if (!runData || !Array.isArray(knownCandidates) || !knownCandidates.length) {
      return null;
    }
    var runs = runData.runs;
    var colors = runData.colors;
    if (!Array.isArray(runs) || !Array.isArray(colors) || !runs.length) {
      return null;
    }

    var best = null;
    var threshold = 0.26;
    for (var c = 0; c < knownCandidates.length; c += 1) {
      var candidate = knownCandidates[c];
      if (!candidate || !Array.isArray(candidate.runs) || !candidate.runs.length) {
        continue;
      }
      var requiredLength = candidate.runs.length;
      if (runs.length < requiredLength) {
        continue;
      }

      for (var start = 0; start <= runs.length - requiredLength; start += 1) {
        if (colors[start] !== 1) {
          continue;
        }
        var observed = runs.slice(start, start + requiredLength);
        var score = scoreCandidateRuns(observed, candidate.runs, candidate.modules);
        if (score > threshold) {
          continue;
        }
        if (!best || score < best.score) {
          best = { candidate: candidate, score: score };
        }
      }
    }
    if (!best) {
      return null;
    }
    return {
      code: best.candidate.normalized,
      score: best.score,
    };
  }

  function matchKnownCode128CandidatesFromImageData(imageData, knownCandidates) {
    if (!imageData || !imageData.width || !imageData.height || !knownCandidates || !knownCandidates.length) {
      return null;
    }

    var preferredRows = collectHighTransitionRows(imageData, 32);
    var votes = new Map();
    for (var r = 0; r < preferredRows.length; r += 1) {
      var rowY = preferredRows[r];
      var rowLine = buildHorizontalLine(imageData, rowY);
      var rowRunData = buildRunDataFromLine(rowLine);
      var rowMatch = matchKnownCode128CandidatesFromRunData(rowRunData, knownCandidates);
      if (!rowMatch) {
        continue;
      }
      var existingVote = votes.get(rowMatch.code) || { count: 0, bestScore: Number.POSITIVE_INFINITY };
      existingVote.count += 1;
      if (rowMatch.score < existingVote.bestScore) {
        existingVote.bestScore = rowMatch.score;
      }
      votes.set(rowMatch.code, existingVote);
    }

    var bestCode = null;
    var bestVote = null;
    votes.forEach(function (vote, code) {
      if (!bestVote || vote.count > bestVote.count || (vote.count === bestVote.count && vote.bestScore < bestVote.bestScore)) {
        bestVote = vote;
        bestCode = code;
      }
    });

    if (!bestVote) {
      return null;
    }

    var secondBestCount = 0;
    votes.forEach(function (vote, code) {
      if (code === bestCode) {
        return;
      }
      if (vote.count > secondBestCount) {
        secondBestCount = vote.count;
      }
    });

    if (bestVote.count >= 3 && (bestVote.count - secondBestCount) >= 2 && bestVote.bestScore <= 0.22) {
      return bestCode;
    }
    return null;
  }

  function matchRunsToSymbol(observedRuns, symbols, maxError) {
    var observedSum = 0;
    for (var i = 0; i < observedRuns.length; i += 1) {
      observedSum += observedRuns[i];
    }
    if (!observedSum) {
      return null;
    }

    var best = null;
    for (var idx = 0; idx < symbols.length; idx += 1) {
      var symbol = symbols[idx];
      if (!symbol || symbol.runs.length !== observedRuns.length) {
        continue;
      }
      var scale = observedSum / symbol.modules;
      var error = 0;
      for (var r = 0; r < observedRuns.length; r += 1) {
        error += Math.abs(observedRuns[r] - (symbol.runs[r] * scale));
      }
      var normalizedError = error / observedSum;
      if (!best || normalizedError < best.error) {
        best = { symbol: symbol, error: normalizedError };
      }
    }

    if (!best || best.error > maxError) {
      return null;
    }
    return {
      code: best.symbol.code,
      error: best.error,
    };
  }

  function decodeCode128(codes) {
    if (!Array.isArray(codes) || codes.length < 3) {
      return null;
    }
    if (codes[0] !== CODE128_START_A && codes[0] !== CODE128_START_B && codes[0] !== CODE128_START_C) {
      return null;
    }

    var checksumCode = codes[codes.length - 1];
    var dataCodes = codes.slice(1, -1);

    var checksum = codes[0];
    for (var i = 0; i < dataCodes.length; i += 1) {
      checksum += dataCodes[i] * (i + 1);
    }
    if ((checksum % 103) !== checksumCode) {
      return null;
    }

    var output = '';
    var activeSet = codes[0];
    var pendingShiftSet = null;
    for (var j = 0; j < dataCodes.length; j += 1) {
      var code = dataCodes[j];

      if (code === 99) {
        activeSet = CODE128_START_C;
        pendingShiftSet = null;
        continue;
      }
      if (code === 100) {
        activeSet = CODE128_START_B;
        pendingShiftSet = null;
        continue;
      }
      if (code === 101) {
        activeSet = CODE128_START_A;
        pendingShiftSet = null;
        continue;
      }
      if (code === 98) {
        if (activeSet === CODE128_START_A) {
          pendingShiftSet = CODE128_START_B;
        } else if (activeSet === CODE128_START_B) {
          pendingShiftSet = CODE128_START_A;
        } else {
          pendingShiftSet = null;
        }
        continue;
      }
      if (code === 96 || code === 97 || code === 102) {
        pendingShiftSet = null;
        continue;
      }
      if (code < 0 || code > CODE128_DATA_MAX) {
        return null;
      }

      var codeSetForValue = pendingShiftSet || activeSet;
      pendingShiftSet = null;

      if (codeSetForValue === CODE128_START_C) {
        output += pad2(code);
        continue;
      }

      if (codeSetForValue === CODE128_START_A) {
        if (code <= 63) {
          output += String.fromCharCode(code + 32);
        } else if (code <= 95) {
          output += String.fromCharCode(code - 64);
        } else {
          return null;
        }
        continue;
      }

      if (codeSetForValue === CODE128_START_B) {
        if (code <= 95) {
          output += String.fromCharCode(code + 32);
          continue;
        }
        return null;
      }
    }
    return output || null;
  }

  function decodeRunsAsCode128(runData) {
    var runs = runData.runs;
    var colors = runData.colors;
    if (!Array.isArray(runs) || !Array.isArray(colors) || runs.length < 20) {
      return null;
    }

    var normalSymbols = CODE128_SYMBOLS.slice(0, CODE128_STOP);
    var stopSymbol = [CODE128_SYMBOLS[CODE128_STOP]];

    for (var startIndex = 0; startIndex <= runs.length - 20; startIndex += 1) {
      if (colors[startIndex] !== 1) {
        continue;
      }
      var startMatch = matchRunsToSymbol(
        runs.slice(startIndex, startIndex + 6),
        normalSymbols,
        CODE128_NORMAL_MATCH_THRESHOLD
      );
      if (!startMatch || (
        startMatch.code !== CODE128_START_A
        && startMatch.code !== CODE128_START_B
        && startMatch.code !== CODE128_START_C
      )) {
        continue;
      }

      var cursor = startIndex + 6;
      var decodedCodes = [startMatch.code];
      var guard = 0;

      while (cursor + 6 <= runs.length && guard < 96) {
        guard += 1;
        if (cursor + 7 <= runs.length) {
          var stopMatch = matchRunsToSymbol(
            runs.slice(cursor, cursor + 7),
            stopSymbol,
            CODE128_STOP_MATCH_THRESHOLD
          );
          if (stopMatch && stopMatch.code === CODE128_STOP) {
            var value = decodeCode128(decodedCodes);
            if (value) {
              return value;
            }
            break;
          }
        }

        var symbolMatch = matchRunsToSymbol(
          runs.slice(cursor, cursor + 6),
          normalSymbols,
          CODE128_NORMAL_MATCH_THRESHOLD
        );
        if (!symbolMatch) {
          break;
        }

        decodedCodes.push(symbolMatch.code);
        cursor += 6;
      }
    }

    return null;
  }

  function decodeCode128FromLine(line) {
    var runData = buildRunDataFromLine(line);
    if (!runData) {
      return null;
    }
    return decodeRunsAsCode128(runData);
  }

  function decodeCode128FromImageData(imageData) {
    if (!imageData || !imageData.width || !imageData.height) {
      return null;
    }

    function pickConfirmed(values) {
      if (!Array.isArray(values) || !values.length) {
        return null;
      }
      var counts = new Map();
      values.forEach(function (value) {
        var current = counts.get(value) || 0;
        counts.set(value, current + 1);
      });
      var bestCode = null;
      var bestCount = 0;
      counts.forEach(function (count, code) {
        if (count > bestCount) {
          bestCount = count;
          bestCode = code;
        }
      });
      if (bestCount >= 2) {
        return bestCode;
      }
      return null;
    }

    var decodedCandidates = [];
    var preferredRows = collectHighTransitionRows(imageData, 24);
    for (var p = 0; p < preferredRows.length; p += 1) {
      var preferredY = preferredRows[p];
      var preferredHorizontal = decodeCode128FromLine(buildHorizontalLine(imageData, preferredY));
      if (preferredHorizontal) {
        decodedCandidates.push(preferredHorizontal);
      }
    }

    var rowOffsets = [0, -2, 2, -4, 4, -6, 6, -8, 8, -12, 12, -16, 16, -22, 22, -28, 28];
    var centerY = Math.floor(imageData.height / 2);
    for (var r = 0; r < rowOffsets.length; r += 1) {
      var y = centerY + rowOffsets[r];
      if (y < 0 || y >= imageData.height) {
        continue;
      }
      var horizontal = decodeCode128FromLine(buildHorizontalLine(imageData, y));
      if (horizontal) {
        decodedCandidates.push(horizontal);
      }
    }

    var colOffsets = [0, -2, 2, -4, 4, -6, 6, -8, 8, -12, 12, -16, 16, -22, 22];
    var centerX = Math.floor(imageData.width / 2);
    for (var c = 0; c < colOffsets.length; c += 1) {
      var x = centerX + colOffsets[c];
      if (x < 0 || x >= imageData.width) {
        continue;
      }
      var vertical = decodeCode128FromLine(buildVerticalLine(imageData, x));
      if (vertical) {
        decodedCandidates.push(vertical);
      }
    }
    return pickConfirmed(decodedCandidates);
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
    var useFallbackCode128Decoder = false;
    var knownCodeCandidates = [];
    var loopTimer = null;
    var activeHandler = null;
    var lastSeen = new Map();
    var throttleMs = 1200;
    var pendingNormalizedCode = '';
    var pendingNormalizedCodeCount = 0;
    var recentDetections = [];
    var recentDetectionWindowSize = 7;
    var snapshotCanvas = document.createElement('canvas');
    var snapshotContext = snapshotCanvas.getContext('2d');
    var rotatedCanvas = document.createElement('canvas');
    var rotatedContext = rotatedCanvas.getContext('2d');

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
      detector = null;
      useFallbackCode128Decoder = false;
      knownCodeCandidates = [];
      pendingNormalizedCode = '';
      pendingNormalizedCodeCount = 0;
      recentDetections = [];
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
      if (!isPlausibleScannedCode(normalized)) {
        return;
      }
      if (pendingNormalizedCode === normalized) {
        pendingNormalizedCodeCount += 1;
      } else {
        pendingNormalizedCode = normalized;
        pendingNormalizedCodeCount = 1;
      }
      if (pendingNormalizedCodeCount < 2) {
        return;
      }
      pendingNormalizedCode = '';
      pendingNormalizedCodeCount = 0;

      recentDetections.push(normalized);
      if (recentDetections.length > recentDetectionWindowSize) {
        recentDetections.shift();
      }

      var counts = new Map();
      recentDetections.forEach(function (item) {
        counts.set(item, (counts.get(item) || 0) + 1);
      });

      var topCode = '';
      var topCount = 0;
      var secondCount = 0;
      counts.forEach(function (count, key) {
        if (count > topCount) {
          secondCount = topCount;
          topCount = count;
          topCode = key;
          return;
        }
        if (count > secondCount) {
          secondCount = count;
        }
      });

      if (topCode !== normalized) {
        return;
      }
      if (topCount < 4 || (topCount - secondCount) < 2) {
        return;
      }

      recentDetections = [];
      if (!shouldAccept(normalized)) {
        return;
      }
      if (typeof activeHandler === 'function') {
        activeHandler(normalized, appendLog);
      }
    }

    function ensureSnapshotSize() {
      if (!videoEl) {
        return false;
      }
      var sourceWidth = videoEl.videoWidth || 0;
      var sourceHeight = videoEl.videoHeight || 0;
      if (!sourceWidth || !sourceHeight) {
        return false;
      }

      var maxWidth = 1600;
      var scale = sourceWidth > maxWidth ? (maxWidth / sourceWidth) : 1;
      var targetWidth = Math.max(1, Math.round(sourceWidth * scale));
      var targetHeight = Math.max(1, Math.round(sourceHeight * scale));

      if (snapshotCanvas.width !== targetWidth || snapshotCanvas.height !== targetHeight) {
        snapshotCanvas.width = targetWidth;
        snapshotCanvas.height = targetHeight;
      }
      return true;
    }

    function getDetectionSource() {
      if (!videoEl || !snapshotContext) {
        return videoEl;
      }
      if (!ensureSnapshotSize()) {
        return videoEl;
      }
      snapshotContext.drawImage(videoEl, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
      return snapshotCanvas;
    }

    function runFallbackDecode(source) {
      if (!snapshotContext) {
        return;
      }
      try {
        var imageData = snapshotContext.getImageData(0, 0, source.width, source.height);
        var decoded = null;
        if (knownCodeCandidates.length) {
          decoded = matchKnownCode128CandidatesFromImageData(imageData, knownCodeCandidates);
        }
        if (!decoded) {
          decoded = decodeCode128FromImageData(imageData);
        }
        if (decoded) {
          handleCode(decoded);
          return;
        }
        if (rotatedContext) {
          if (rotatedCanvas.width !== source.height || rotatedCanvas.height !== source.width) {
            rotatedCanvas.width = source.height;
            rotatedCanvas.height = source.width;
          }
          rotatedContext.save();
          rotatedContext.translate(rotatedCanvas.width * 0.5, rotatedCanvas.height * 0.5);
          rotatedContext.rotate(Math.PI * 0.5);
          rotatedContext.drawImage(source, -source.width * 0.5, -source.height * 0.5, source.width, source.height);
          rotatedContext.restore();
          var rotatedImageData = rotatedContext.getImageData(0, 0, rotatedCanvas.width, rotatedCanvas.height);
          decoded = null;
          if (knownCodeCandidates.length) {
            decoded = matchKnownCode128CandidatesFromImageData(rotatedImageData, knownCodeCandidates);
          }
          if (!decoded) {
            decoded = decodeCode128FromImageData(rotatedImageData);
          }
        }
        if (decoded) {
          handleCode(decoded);
        }
      } catch (err) {
        // non-fatal fallback decode errors
      }
    }

    function scanLoop() {
      if (!videoEl || !stream) {
        return;
      }
      if (videoEl.readyState < 2) {
        loopTimer = setTimeout(scanLoop, useFallbackCode128Decoder ? FALLBACK_SCAN_INTERVAL_MS : DETECTOR_SCAN_INTERVAL_MS);
        return;
      }

      var source = getDetectionSource();

      if (detector) {
        detector.detect(source)
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
            // detector errors are non-fatal inside loop
          })
          .finally(function () {
            loopTimer = setTimeout(scanLoop, DETECTOR_SCAN_INTERVAL_MS);
          });
        return;
      }

      if (useFallbackCode128Decoder && source && source.width && source.height) {
        runFallbackDecode(source);
      }
      loopTimer = setTimeout(scanLoop, FALLBACK_SCAN_INTERVAL_MS);
    }

    function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('Kamera nicht verfügbar. Bitte Code manuell eingeben.');
        return Promise.resolve();
      }

      function tryCameraConstraints(constraintsList, index) {
        if (index >= constraintsList.length) {
          return Promise.reject(new Error('camera-unavailable'));
        }
        return navigator.mediaDevices.getUserMedia(constraintsList[index]).catch(function () {
          return tryCameraConstraints(constraintsList, index + 1);
        });
      }

      var constraintsList = [
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            aspectRatio: { ideal: 1.7777777778 },
            width: { ideal: 2560 },
            height: { ideal: 1440 },
            advanced: [{ focusMode: 'continuous' }],
          },
        },
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            aspectRatio: { ideal: 1.7777777778 },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
          },
        },
      ];

      return tryCameraConstraints(constraintsList, 0).then(function (mediaStream) {
        stream = mediaStream;
        if (videoEl) {
          videoEl.srcObject = stream;
          return videoEl.play();
        }
        return null;
      }).then(function () {
        if (window.BarcodeDetector) {
          var preferredFormats = [
            'code_128', 'code_39', 'codabar', 'itf',
            'qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'data_matrix',
          ];
          var hasSupportedFormatsApi = typeof window.BarcodeDetector.getSupportedFormats === 'function';
          if (hasSupportedFormatsApi) {
            return window.BarcodeDetector.getSupportedFormats()
              .then(function (supportedFormats) {
                var formats = preferredFormats.filter(function (entry) {
                  return supportedFormats.indexOf(entry) !== -1;
                });
                detector = new window.BarcodeDetector({ formats: formats.length ? formats : undefined });
                setStatus('Scanner aktiv. Mehrere Labels nacheinander scannen.');
                scanLoop();
              })
              .catch(function () {
                try {
                  detector = new window.BarcodeDetector();
                  setStatus('Scanner aktiv. Mehrere Labels nacheinander scannen.');
                  scanLoop();
                } catch (err) {
                  useFallbackCode128Decoder = true;
                  setStatus('Scanner aktiv (Fallback für Code128). Mehrere Labels nacheinander scannen.');
                  scanLoop();
                }
              });
          }
          try {
            detector = new window.BarcodeDetector();
            setStatus('Scanner aktiv. Mehrere Labels nacheinander scannen.');
            scanLoop();
            return null;
          } catch (error) {
            useFallbackCode128Decoder = true;
            setStatus('Scanner aktiv (Fallback für Code128). Mehrere Labels nacheinander scannen.');
            scanLoop();
            return null;
          }
        }

        useFallbackCode128Decoder = true;
        setStatus('Scanner aktiv (Fallback für Code128). Mehrere Labels nacheinander scannen.');
        scanLoop();
        return null;
      }).catch(function () {
        setStatus('Kamera konnte nicht geöffnet werden. Bitte Code manuell eingeben.');
      });
    }

    function resetState() {
      activeHandler = null;
      detector = null;
      useFallbackCode128Decoder = false;
      knownCodeCandidates = [];
      lastSeen = new Map();
      pendingNormalizedCode = '';
      pendingNormalizedCodeCount = 0;
      recentDetections = [];
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
      knownCodeCandidates = buildKnownCode128Candidates(
        config && Array.isArray(config.knownCodes) ? config.knownCodes : []
      );
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
