(function () {
  var TARGET_UPLOAD_IMAGE_HEIGHT = 1000;
  var RESIZABLE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  function isQuillContentEmpty(quill) {
    if (!quill) {
      return true;
    }
    var text = String(quill.getText() || '').replace(/\u00a0/g, ' ').trim();
    var html = String(quill.root && quill.root.innerHTML ? quill.root.innerHTML : '').trim();
    if (text) {
      return false;
    }
    if (/<table[\s>]/i.test(html)) {
      return false;
    }
    return !html || html === '<br>' || html === '<p><br></p>';
  }

  function buildTableMarkup(rowCount, columnCount) {
    var rows = [];
    for (var rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      var cells = [];
      for (var columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        var cellTag = rowIndex === 0 ? 'th' : 'td';
        cells.push('<' + cellTag + '> </' + cellTag + '>');
      }
      rows.push('<tr>' + cells.join('') + '</tr>');
    }
    return '<table><tbody>' + rows.join('') + '</tbody></table><p><br></p>';
  }

  function normalizeQuillHtmlForStorage(html) {
    var source = String(html || '').trim();
    if (!source) {
      return '';
    }

    var container = document.createElement('div');
    container.innerHTML = source;
    var olNodes = container.querySelectorAll('ol');

    olNodes.forEach(function (olNode) {
      var items = Array.prototype.slice.call(olNode.children || []).filter(function (child) {
        return child && child.tagName === 'LI';
      });
      if (!items.length) {
        return;
      }

      var hasQuillListMetadata = items.some(function (li) {
        return li.hasAttribute('data-list');
      });
      if (!hasQuillListMetadata) {
        return;
      }

      var replacementFragment = document.createDocumentFragment();
      var currentList = null;
      var currentListType = '';

      items.forEach(function (li) {
        var listToken = String(li.getAttribute('data-list') || 'bullet').toLowerCase();
        var targetListType = listToken === 'ordered' ? 'ol' : 'ul';

        if (!currentList || currentListType !== targetListType) {
          currentList = document.createElement(targetListType);
          currentListType = targetListType;
          replacementFragment.appendChild(currentList);
        }

        var targetLi = document.createElement('li');
        targetLi.innerHTML = li.innerHTML;
        currentList.appendChild(targetLi);
      });

      if (olNode.parentNode) {
        olNode.parentNode.replaceChild(replacementFragment, olNode);
      }
    });

    return container.innerHTML.trim();
  }

  function bindQuillEditors() {
    var wrappers = document.querySelectorAll('[data-quill-editor]');
    if (!wrappers.length) {
      return;
    }

    if (!window.Quill) {
      window.console.error('Quill konnte nicht geladen werden.');
      return;
    }

    var editors = [];

    wrappers.forEach(function (wrapper) {
      var targetInputId = wrapper.getAttribute('data-quill-editor');
      var hiddenField = targetInputId ? document.getElementById(targetInputId) : null;
      var editorContainer = wrapper.querySelector('[data-quill-content]');
      var toolbarContainer = wrapper.querySelector('[data-quill-toolbar]');
      if (!hiddenField || !editorContainer || !toolbarContainer) {
        return;
      }

      var quill = new window.Quill(editorContainer, {
        theme: 'snow',
        modules: {
          toolbar: {
            container: toolbarContainer,
            handlers: {
              insertTable: function () {
                var rowsInput = window.prompt('Anzahl Zeilen (inkl. Kopfzeile):', '2');
                if (rowsInput === null) {
                  return;
                }
                var colsInput = window.prompt('Anzahl Spalten:', '2');
                if (colsInput === null) {
                  return;
                }
                var rowCount = Math.max(parseInt(rowsInput, 10) || 0, 1);
                var columnCount = Math.max(parseInt(colsInput, 10) || 0, 1);
                var selection = quill.getSelection(true);
                var index = selection ? selection.index : quill.getLength();
                quill.clipboard.dangerouslyPasteHTML(index, buildTableMarkup(rowCount, columnCount), 'user');
              },
            },
          },
        },
      });

      if (hiddenField.value) {
        quill.clipboard.dangerouslyPasteHTML(hiddenField.value);
      }

      editors.push({
        quill: quill,
        hiddenField: hiddenField,
      });
    });

    var form = document.getElementById('assetModelForm');
    if (!form) {
      return;
    }

    form.addEventListener('submit', function () {
      editors.forEach(function (entry) {
        if (isQuillContentEmpty(entry.quill)) {
          entry.hiddenField.value = '';
          return;
        }

        var normalizedHtml = normalizeQuillHtmlForStorage(entry.quill.root.innerHTML || '');
        entry.hiddenField.value = normalizedHtml;
      });
    });
  }

  function isResizableImageFile(file) {
    var mimeType = String(file && file.type ? file.type : '').toLowerCase();
    return RESIZABLE_IMAGE_MIME_TYPES.indexOf(mimeType) !== -1;
  }

  function getResizedImageMimeType(file) {
    var mimeType = String(file && file.type ? file.type : '').toLowerCase();
    if (RESIZABLE_IMAGE_MIME_TYPES.indexOf(mimeType) !== -1) {
      return mimeType;
    }
    return 'image/jpeg';
  }

  function getFileExtensionFromMimeType(mimeType) {
    if (mimeType === 'image/png') {
      return '.png';
    }
    if (mimeType === 'image/webp') {
      return '.webp';
    }
    return '.jpg';
  }

  function withFileExtension(filename, extension) {
    var safeFilename = String(filename || 'image');
    var dotIndex = safeFilename.lastIndexOf('.');
    var base = dotIndex > 0 ? safeFilename.slice(0, dotIndex) : safeFilename;
    return base + extension;
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(new Error('Datei konnte nicht gelesen werden.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        resolve(image);
      };
      image.onerror = function () {
        reject(new Error('Bild konnte nicht geladen werden.'));
      };
      image.src = dataUrl;
    });
  }

  function canvasToBlob(canvas, mimeType) {
    return new Promise(function (resolve, reject) {
      var quality = mimeType === 'image/jpeg' ? 0.92 : undefined;
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error('Bild konnte nicht verarbeitet werden.'));
          return;
        }
        resolve(blob);
      }, mimeType, quality);
    });
  }

  async function resizeImageFile(file, targetHeight) {
    if (!isResizableImageFile(file)) {
      return file;
    }

    var imageDataUrl = await readFileAsDataUrl(file);
    var image = await loadImage(imageDataUrl);
    if (!image.width || !image.height) {
      return file;
    }

    var resolvedTargetHeight = Math.max(parseInt(targetHeight || TARGET_UPLOAD_IMAGE_HEIGHT, 10) || TARGET_UPLOAD_IMAGE_HEIGHT, 1);
    var scale = resolvedTargetHeight / image.height;
    var targetWidth = Math.max(Math.round(image.width * scale), 1);
    var canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = resolvedTargetHeight;

    var context = canvas.getContext('2d');
    if (!context) {
      return file;
    }
    context.drawImage(image, 0, 0, targetWidth, resolvedTargetHeight);

    var outputMimeType = getResizedImageMimeType(file);
    var outputBlob = await canvasToBlob(canvas, outputMimeType);
    var outputFilename = withFileExtension(file.name || 'image', getFileExtensionFromMimeType(outputMimeType));
    return new File([outputBlob], outputFilename, {
      type: outputMimeType,
      lastModified: Date.now(),
    });
  }

  async function normalizeImageUploadInput(imageInput, targetHeight) {
    if (!imageInput || !imageInput.files || !imageInput.files.length) {
      return false;
    }
    if (typeof DataTransfer === 'undefined') {
      return false;
    }

    var sourceFiles = Array.prototype.slice.call(imageInput.files);
    var resizedFiles = await Promise.all(sourceFiles.map(function (file) {
      return resizeImageFile(file, targetHeight);
    }));

    var transfer = new DataTransfer();
    resizedFiles.forEach(function (file) {
      transfer.items.add(file);
    });
    imageInput.files = transfer.files;
    return true;
  }

  function bindUploadProgress() {
    var form = document.querySelector('form[data-upload-form="asset-model"]');
    if (!form) {
      return;
    }

    var imageInput = form.querySelector('input[type="file"][name="images"]');
    var progressContainer = form.querySelector('[data-upload-progress-container]');
    var progressBar = form.querySelector('[data-upload-progress-bar]');
    var progressLabel = form.querySelector('[data-upload-progress-label]');
    var progressPercent = form.querySelector('[data-upload-progress-percent]');
    var progressError = form.querySelector('[data-upload-progress-error]');
    var progressTimer = null;

    function hasSelectedUploadFiles() {
      var fileInputs = form.querySelectorAll('input[type="file"]');
      for (var i = 0; i < fileInputs.length; i += 1) {
        var input = fileInputs[i];
        if (input && input.files && input.files.length > 0) {
          return true;
        }
      }
      return false;
    }

    function setUploadBusyState(isBusy) {
      var submitButtons = form.querySelectorAll('button[type="submit"]');
      submitButtons.forEach(function (button) {
        button.disabled = Boolean(isBusy);
      });
    }

    function ensureFileInputsEnabled() {
      var fileInputs = form.querySelectorAll('input[type="file"]');
      fileInputs.forEach(function (input) {
        if (input) {
          input.disabled = false;
        }
      });
    }

    function setProgress(value) {
      var safeValue = Math.max(0, Math.min(100, value));
      var text = safeValue + '%';
      if (progressBar) {
        progressBar.style.width = text;
        progressBar.textContent = text;
        progressBar.setAttribute('aria-valuenow', String(safeValue));
      }
      if (progressPercent) {
        progressPercent.textContent = text;
      }
    }

    function startProgressAnimation() {
      var value = 6;
      setProgress(value);
      progressTimer = window.setInterval(function () {
        if (value >= 95) {
          return;
        }
        value += value < 70 ? 6 : 2;
        setProgress(Math.min(value, 95));
      }, 250);
    }

    function showProgressUI() {
      if (progressContainer) {
        progressContainer.classList.remove('d-none');
      }
      if (progressLabel) {
        progressLabel.textContent = 'Dateien werden hochgeladen ...';
      }
      if (progressError) {
        progressError.classList.add('d-none');
        progressError.textContent = '';
      }
      startProgressAnimation();
    }

    form.addEventListener('submit', function (event) {
      if (form.dataset.uploadInFlight === '1' || form.dataset.uploadPreparing === '1') {
        event.preventDefault();
        return;
      }

      var hasImageUpload = Boolean(imageInput && imageInput.files && imageInput.files.length);
      if (hasImageUpload && form.dataset.uploadPrepared !== '1') {
        event.preventDefault();
        form.dataset.uploadPreparing = '1';
        setUploadBusyState(true);
        if (progressContainer) {
          progressContainer.classList.remove('d-none');
        }
        if (progressLabel) {
          progressLabel.textContent = 'Bilder werden skaliert ...';
        }
        if (progressError) {
          progressError.classList.add('d-none');
          progressError.textContent = '';
        }
        setProgress(5);

        normalizeImageUploadInput(imageInput, TARGET_UPLOAD_IMAGE_HEIGHT)
          .catch(function () {
            if (progressError) {
              progressError.classList.remove('d-none');
              progressError.textContent = 'Bilder konnten nicht skaliert werden. Upload läuft mit Originaldateien.';
            }
          })
          .finally(function () {
            form.dataset.uploadPreparing = '';
            form.dataset.uploadPrepared = '1';
            setUploadBusyState(false);
            if (typeof form.requestSubmit === 'function') {
              form.requestSubmit();
              return;
            }
            form.submit();
          });
        return;
      }

      form.dataset.uploadPrepared = '';
      if (!hasSelectedUploadFiles()) {
        return;
      }

      ensureFileInputsEnabled();
      form.dataset.uploadInFlight = '1';
      setUploadBusyState(true);
      showProgressUI();
    });

    window.addEventListener('pageshow', function () {
      form.dataset.uploadInFlight = '';
      form.dataset.uploadPreparing = '';
      form.dataset.uploadPrepared = '';
      setUploadBusyState(false);
    });

    window.addEventListener('beforeunload', function () {
      if (progressTimer) {
        window.clearInterval(progressTimer);
      }
    });
  }

  function updatePanels() {
    var trackingTypeSelect = document.getElementById('trackingType');
    if (!trackingTypeSelect) return;
    var value = trackingTypeSelect.value || 'serialized';
    var bulkPanels = document.querySelectorAll('[data-tracking-panel="bulk"]');
    var bundlePanels = document.querySelectorAll('[data-tracking-panel="bundle"]');

    bulkPanels.forEach(function (panel) {
      panel.classList.toggle('d-none', value !== 'bulk');
      panel.querySelectorAll('input,select,textarea').forEach(function (field) {
        if (value !== 'bulk' && field.name && (
          field.name === 'quantityTotal' ||
          field.name === 'quantityAvailable' ||
          field.name === 'minThreshold' ||
          field.name === 'reorderThreshold'
        )) {
          field.disabled = true;
        } else if (
          value === 'bulk' &&
          field.name &&
          (
            field.name === 'quantityTotal' ||
            field.name === 'quantityAvailable' ||
            field.name === 'minThreshold' ||
            field.name === 'reorderThreshold'
          )
        ) {
          field.disabled = false;
        }
      });
    });

    bundlePanels.forEach(function (panel) {
      panel.classList.toggle('d-none', value !== 'bundle');
      panel.querySelectorAll('input,select,textarea,button').forEach(function (field) {
        if (value !== 'bundle') {
          if (field.name && (
            field.name === 'bundleName' ||
            field.name === 'bundleDescription' ||
            field.name === 'componentAssetModelId[]' ||
            field.name === 'componentQuantity[]' ||
            field.name === 'componentIsOptional[]'
          )) {
            field.disabled = true;
          }
          if (field.hasAttribute('data-bundle-add-row') || field.hasAttribute('data-bundle-remove-row')) {
            field.disabled = true;
          }
        } else {
          if (field.name && (
            field.name === 'bundleName' ||
            field.name === 'bundleDescription' ||
            field.name === 'componentAssetModelId[]' ||
            field.name === 'componentQuantity[]' ||
            field.name === 'componentIsOptional[]'
          )) {
            field.disabled = false;
          }
          if (field.hasAttribute('data-bundle-add-row') || field.hasAttribute('data-bundle-remove-row')) {
            field.disabled = false;
          }
        }
      });
    });
  }

  function bindBundleRows() {
    var addButtons = document.querySelectorAll('[data-bundle-add-row]');
    addButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        var panel = button.closest('[data-tracking-panel="bundle"]');
        if (!panel) return;
        var tbody = panel.querySelector('[data-bundle-components]');
        var templateContainer = panel.querySelector('[data-bundle-row-template]');
        if (!tbody || !templateContainer) return;
        var templateRow = null;
        if (templateContainer.tagName && templateContainer.tagName.toLowerCase() === 'template') {
          templateRow = templateContainer.content.querySelector('[data-bundle-component-row]');
        } else {
          templateRow = templateContainer.querySelector('[data-bundle-component-row]');
        }
        if (!templateRow) return;
        var clone = templateRow.cloneNode(true);
        tbody.appendChild(clone);
        updatePanels();
      });
    });

    document.addEventListener('click', function (event) {
      var removeButton = event.target.closest('[data-bundle-remove-row]');
      if (!removeButton) return;
      var row = removeButton.closest('[data-bundle-component-row]');
      var tbody = row ? row.parentElement : null;
      if (!row || !tbody) return;
      if (tbody.querySelectorAll('[data-bundle-component-row]').length <= 1) {
        row.querySelectorAll('input,select').forEach(function (field) {
          if (field.tagName === 'SELECT') {
            field.selectedIndex = 0;
          } else {
            field.value = field.name === 'componentQuantity[]' ? '1' : '';
          }
        });
        return;
      }
      row.remove();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindQuillEditors();
    var trackingTypeSelect = document.getElementById('trackingType');
    if (trackingTypeSelect) {
      trackingTypeSelect.addEventListener('change', updatePanels);
      bindBundleRows();
      updatePanels();
    }
    bindUploadProgress();
  });
})();
