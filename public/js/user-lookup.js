(function () {
  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, wait);
    };
  }

  function initLookup(container) {
    var input = container.querySelector('[data-user-lookup-input]');
    var hidden = container.querySelector('[data-user-lookup-id]');
    var results = container.querySelector('[data-user-lookup-results]');
    var empty = container.querySelector('[data-user-lookup-empty]');
    if (!input || !hidden || !results) return;

    function clearResults() {
      results.innerHTML = '';
      results.classList.add('d-none');
      if (empty) empty.classList.add('d-none');
    }

    function showEmpty() {
      results.innerHTML = '';
      results.classList.add('d-none');
      if (empty) empty.classList.remove('d-none');
    }

    function render(users) {
      results.innerHTML = '';
      if (!users.length) {
        showEmpty();
        return;
      }
      if (empty) empty.classList.add('d-none');
      users.forEach(function (user) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'list-group-item list-group-item-action';
        var label = (user.firstName || '').trim() + ' ' + (user.lastName || '').trim();
        label = label.trim() || user.username || '';
        var secondary = user.email || user.username || '';
        button.textContent = label + (secondary ? ' (' + secondary + ')' : '');
        button.addEventListener('click', function () {
          input.value = label || secondary;
          hidden.value = user.id;
          clearResults();
        });
        results.appendChild(button);
      });
      results.classList.remove('d-none');
    }

    var runSearch = debounce(function () {
      var term = input.value.trim();
      hidden.value = '';
      if (term.length < 2) {
        clearResults();
        return;
      }
      var url = '/api/v1/users/search?q=' + encodeURIComponent(term) + '&isActive=true&limit=10';
      fetch(url, { credentials: 'same-origin' })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (payload) {
          if (!payload || !payload.data) {
            showEmpty();
            return;
          }
          render(payload.data);
        })
        .catch(function () {
          showEmpty();
        });
    }, 250);

    input.addEventListener('input', runSearch);
    input.addEventListener('focus', runSearch);
    document.addEventListener('click', function (event) {
      if (!container.contains(event.target)) {
        clearResults();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var containers = document.querySelectorAll('[data-user-lookup]');
    Array.prototype.forEach.call(containers, initLookup);
  });
})();
