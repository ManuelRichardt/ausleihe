(function () {
  function parseLoanIdFromPath() {
    var match = window.location.pathname.match(/\/admin\/loans\/([^/]+)/);
    return match ? match[1] : null;
  }

  function initModelSearch() {
    var input = document.getElementById('assetModelSearch');
    var hidden = document.getElementById('assetModelId');
    var box = document.getElementById('assetModelSuggestions');
    if (!input || !hidden || !box) {
      return;
    }

    var loanId = parseLoanIdFromPath();
    if (!loanId) {
      return;
    }

    var timeoutId = null;

    function closeBox() {
      box.classList.add('d-none');
      box.innerHTML = '';
    }

    function renderSuggestions(items) {
      if (!Array.isArray(items) || !items.length) {
        closeBox();
        return;
      }
      box.innerHTML = '';
      items.forEach(function (item) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'list-group-item list-group-item-action';
        button.textContent = [item.name, item.manufacturerName, item.categoryName].filter(Boolean).join(' — ');
        button.addEventListener('click', function () {
          input.value = button.textContent;
          hidden.value = item.id;
          closeBox();
        });
        box.appendChild(button);
      });
      box.classList.remove('d-none');
    }

    input.addEventListener('input', function () {
      hidden.value = '';
      var q = String(input.value || '').trim();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (q.length < 2) {
        closeBox();
        return;
      }
      timeoutId = setTimeout(function () {
        fetch('/admin/loans/' + encodeURIComponent(loanId) + '/models/search?q=' + encodeURIComponent(q), {
          credentials: 'same-origin',
        })
          .then(function (res) { return res.json(); })
          .then(function (payload) { renderSuggestions(payload && payload.data ? payload.data : []); })
          .catch(function () { closeBox(); });
      }, 180);
    });

    document.addEventListener('click', function (event) {
      if (!box.contains(event.target) && event.target !== input) {
        closeBox();
      }
    });
  }

  function initReturnSelectAll() {
    var all = document.getElementById('returnSelectAll');
    if (!all) return;
    all.addEventListener('change', function () {
      document.querySelectorAll('.return-item-checkbox').forEach(function (cb) {
        cb.checked = all.checked;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initModelSearch();
    initReturnSelectAll();
  });
})();
