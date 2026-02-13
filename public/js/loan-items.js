(function () {
  function init() {
    var search = document.getElementById('assetModelSearch');
    var select = document.getElementById('assetModelId');
    if (!search || !select) return;

    function filterOptions() {
      var q = String(search.value || '').toLowerCase();
      var options = select.querySelectorAll('option');
      options.forEach(function (opt) {
        if (!opt.value) return;
        var text = String(opt.textContent || '').toLowerCase();
        opt.hidden = q && text.indexOf(q) === -1;
      });
    }

    search.addEventListener('input', filterOptions);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
