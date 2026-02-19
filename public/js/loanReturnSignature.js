(function () {
  const form = document.getElementById('returnItemsForm');
  const canvas = document.getElementById('returnSignatureCanvas');
  const hiddenInput = document.getElementById('returnSignatureBase64');
  const signedAtInput = document.getElementById('returnSignedAt');
  const clearButton = document.getElementById('returnSignatureClear');
  const selectAll = document.getElementById('returnSelectAll');
  const rowCheckboxes = Array.from(document.querySelectorAll('.return-item-checkbox'));

  if (!form || !canvas || !hiddenInput) {
    return;
  }

  const ctx = canvas.getContext('2d');
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

  function clearSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
    hiddenInput.value = '';
  }

  function saveSignature() {
    if (!hasDrawn) {
      alert('Bitte unterschreiben Sie für die Rücknahme.');
      return false;
    }
    hiddenInput.value = canvas.toDataURL('image/png');
    return true;
  }

  function refreshSignedAt() {
    if (signedAtInput) {
      signedAtInput.value = new Date().toISOString();
    }
  }

  function syncHeaderCheckbox() {
    if (!selectAll) {
      return;
    }
    const selectable = rowCheckboxes.filter(function (cb) {
      return !cb.disabled;
    });
    if (!selectable.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    const selected = selectable.filter(function (cb) {
      return cb.checked;
    });
    selectAll.checked = selected.length === selectable.length;
    selectAll.indeterminate = selected.length > 0 && selected.length < selectable.length;
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
      clearSignature();
    });
  }

  if (selectAll) {
    selectAll.addEventListener('change', function () {
      rowCheckboxes.forEach(function (checkbox) {
        if (!checkbox.disabled) {
          checkbox.checked = Boolean(selectAll.checked);
        }
      });
      syncHeaderCheckbox();
    });
  }

  rowCheckboxes.forEach(function (checkbox) {
    checkbox.addEventListener('change', function () {
      syncHeaderCheckbox();
    });
  });

  syncHeaderCheckbox();
  refreshSignedAt();

  form.addEventListener('submit', function (evt) {
    refreshSignedAt();

    const selectedCount = rowCheckboxes.filter(function (checkbox) {
      return checkbox.checked;
    }).length;
    if (selectedCount === 0) {
      evt.preventDefault();
      alert('Bitte mindestens ein Item auswählen.');
      return;
    }

    const ok = saveSignature();
    if (!ok) {
      evt.preventDefault();
    }
  });
})();
