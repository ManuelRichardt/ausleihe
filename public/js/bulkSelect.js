(function () {
  function initBulkSelect(container) {
    var master = container.querySelector('[data-bulk-select-all]');
    var toggle = container.querySelector('[data-bulk-select-toggle]');
    var items = Array.prototype.slice.call(container.querySelectorAll('[data-bulk-select-item]'));

    if (!master || !items.length) {
      return;
    }

    function setAll(checked) {
      items.forEach(function (item) {
        item.checked = checked;
      });
      master.checked = checked;
      master.indeterminate = false;
    }

    function updateMaster() {
      var checkedCount = items.filter(function (item) { return item.checked; }).length;
      if (checkedCount === 0) {
        master.checked = false;
        master.indeterminate = false;
        return;
      }
      if (checkedCount === items.length) {
        master.checked = true;
        master.indeterminate = false;
        return;
      }
      master.checked = false;
      master.indeterminate = true;
    }

    master.addEventListener('change', function () {
      setAll(master.checked);
    });

    if (toggle) {
      toggle.addEventListener('click', function () {
        var shouldSelectAll = !items.every(function (item) { return item.checked; });
        setAll(shouldSelectAll);
      });
    }

    items.forEach(function (item) {
      item.addEventListener('change', updateMaster);
    });

    updateMaster();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var containers = document.querySelectorAll('[data-bulk-select]');
    Array.prototype.forEach.call(containers, initBulkSelect);
  });
})();
