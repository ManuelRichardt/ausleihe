(function () {
  function buildRoleRow(template) {
    var row = template.cloneNode(true);
    return row;
  }

  function init(container) {
    var form = container.closest('form');
    if (!form) return;

    var actionInput = form.querySelector('input[name="action"]');
    if (!actionInput) {
      actionInput = document.createElement('input');
      actionInput.type = 'hidden';
      actionInput.name = 'action';
      form.appendChild(actionInput);
    }

    var rowsWrapper = container;
    var mode = rowsWrapper.getAttribute('data-bulk-role-rows') || '';

    var controls = rowsWrapper.parentElement;
    var addButton = controls.querySelector('[data-add-role-row]');
    var submitButton = controls.querySelector(mode === 'remove' ? '[data-bulk-remove-submit]' : '[data-bulk-assign-submit]');

    function updateRowVisibility(row) {
      var roleSelect = row.querySelector('[data-role-select]');
      var locationSelect = row.querySelector('[data-role-location]');
      if (!roleSelect) return;
      var selected = roleSelect.options[roleSelect.selectedIndex];
      var scope = selected ? selected.getAttribute('data-role-scope') : '';
      if (locationSelect) {
        if (scope === 'ausleihe') {
          locationSelect.removeAttribute('disabled');
        } else {
          locationSelect.value = '';
          locationSelect.setAttribute('disabled', 'disabled');
        }
      }
    }

    function bindRow(row) {
      var roleSelect = row.querySelector('[data-role-select]');
      var removeButton = row.querySelector('[data-remove-role-row]');

      if (roleSelect) {
        roleSelect.addEventListener('change', function () {
          updateRowVisibility(row);
        });
        updateRowVisibility(row);
      }

      if (removeButton) {
        removeButton.addEventListener('click', function () {
          if (rowsWrapper.children.length > 1) {
            row.remove();
          } else {
            var selects = row.querySelectorAll('select');
            selects.forEach(function (select) {
              select.value = '';
            });
            updateRowVisibility(row);
          }
        });
      }
    }

    Array.prototype.forEach.call(rowsWrapper.children, bindRow);

    if (addButton) {
      addButton.addEventListener('click', function () {
        var template = rowsWrapper.children[0];
        if (!template) return;
        var newRow = buildRoleRow(template);
        var selects = newRow.querySelectorAll('select');
        selects.forEach(function (select) {
          select.value = '';
        });
        rowsWrapper.appendChild(newRow);
        bindRow(newRow);
      });
    }

    if (submitButton) {
      submitButton.addEventListener('click', function () {
        actionInput.value = mode === 'remove' ? 'remove_role' : 'assign_role';
        if (mode !== 'remove') {
          var invalid = false;
          Array.prototype.forEach.call(rowsWrapper.children, function (row) {
            var roleSelect = row.querySelector('[data-role-select]');
            var locationSelect = row.querySelector('[data-role-location]');
            if (!roleSelect || !locationSelect) return;
            var selected = roleSelect.options[roleSelect.selectedIndex];
            var scope = selected ? selected.getAttribute('data-role-scope') : '';
            if (scope === 'ausleihe' && !locationSelect.value) {
              invalid = true;
            }
          });
          if (invalid) {
            alert('Bitte für ausleihe-spezifische Rollen eine Ausleihe auswählen.');
            return;
          }
        }
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.submit();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var containers = document.querySelectorAll('[data-bulk-role-rows]');
    Array.prototype.forEach.call(containers, function (container) {
      init(container);
    });
  });
})();
