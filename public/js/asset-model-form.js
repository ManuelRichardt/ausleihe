(function () {
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
    var trackingTypeSelect = document.getElementById('trackingType');
    if (!trackingTypeSelect) return;
    trackingTypeSelect.addEventListener('change', updatePanels);
    bindBundleRows();
    updatePanels();
  });
})();
