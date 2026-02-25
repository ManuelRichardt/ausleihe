(function () {
  const canvas = document.getElementById('signatureCanvas');
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const clearButton = document.getElementById('signatureClear');
  const saveButton = document.getElementById('signatureSave');
  const input = document.getElementById('signatureBase64');
  const form = document.getElementById('signatureForm');
  const signatureTypeSelect = document.getElementById('signatureType');
  const signedByInput = document.getElementById('signedByName');
  const handoverSignerNameInput = document.getElementById('handoverSignerName');
  const returnSignerNameInput = document.getElementById('returnSignerName');
  let drawing = false;
  let hasDrawn = false;

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
  }

  function getPos(evt) {
    const rect = canvas.getBoundingClientRect();
    if (evt.touches && evt.touches.length) {
      return {
        x: evt.touches[0].clientX - rect.left,
        y: evt.touches[0].clientY - rect.top,
      };
    }
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  }

  function startDraw(evt) {
    drawing = true;
    const pos = getPos(evt);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasDrawn = true;
  }

  function draw(evt) {
    if (!drawing) {
      return;
    }
    const pos = getPos(evt);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasDrawn = true;
  }

  function stopDraw() {
    drawing = false;
  }

  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
    if (input) {
      input.value = '';
    }
  }

  function save() {
    if (!hasDrawn) {
      alert('Bitte unterschreiben.');
      return false;
    }
    const data = canvas.toDataURL('image/png');
    if (input) {
      input.value = data;
    }
    return true;
  }

  function syncSignedByName() {
    if (!signatureTypeSelect || !signedByInput) {
      return;
    }
    const handoverName = handoverSignerNameInput ? handoverSignerNameInput.value : '';
    const returnName = returnSignerNameInput ? returnSignerNameInput.value : '';
    if (signatureTypeSelect.value === 'return') {
      signedByInput.value = returnName || signedByInput.value;
      return;
    }
    signedByInput.value = handoverName || signedByInput.value;
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  canvas.addEventListener('touchstart', function (evt) {
    evt.preventDefault();
    startDraw(evt);
  });
  canvas.addEventListener('touchmove', function (evt) {
    evt.preventDefault();
    draw(evt);
  });
  canvas.addEventListener('touchend', function (evt) {
    evt.preventDefault();
    stopDraw();
  });

  if (clearButton) {
    clearButton.addEventListener('click', function (evt) {
      evt.preventDefault();
      clear();
    });
  }

  if (saveButton) {
    saveButton.addEventListener('click', function () {
      save();
    });
  }

  if (form) {
    form.addEventListener('submit', function (evt) {
      const saved = save();
      if (!saved) {
        evt.preventDefault();
      }
    });
  }

  if (signatureTypeSelect) {
    signatureTypeSelect.addEventListener('change', syncSignedByName);
  }
  syncSignedByName();
})();
