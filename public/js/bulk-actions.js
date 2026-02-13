(function () {
  function initBulkActions(container) {
    var form = container.closest('form');
    if (!form) return;

    var actionInput = form.querySelector('input[name="action"]');
    var roleInput = form.querySelector('input[name="roleId"]');

    if (!actionInput) {
      actionInput = document.createElement('input');
      actionInput.type = 'hidden';
      actionInput.name = 'action';
      form.appendChild(actionInput);
    }

    if (!roleInput) {
      roleInput = document.createElement('input');
      roleInput.type = 'hidden';
      roleInput.name = 'roleId';
      form.appendChild(roleInput);
    }

    container.addEventListener('click', function (event) {
      var button = event.target.closest('[data-bulk-action]');
      if (!button) return;

      var action = button.getAttribute('data-bulk-action');
      var roleId = button.getAttribute('data-role-id') || '';

      actionInput.value = action || '';
      roleInput.value = roleId;

      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.submit();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var containers = document.querySelectorAll('[data-bulk-actions]');
    Array.prototype.forEach.call(containers, initBulkActions);
  });
})();
