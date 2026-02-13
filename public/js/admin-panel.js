
  const sidebar = document.getElementById('adminSidebar');
  const mainContent = document.getElementsByClassName('main-content')[0];

  function syncState() {
    if (sidebar.classList.contains('show')) {
      mainContent.classList.add('admin-panel-open');
      mainContent.classList.remove('admin-panel-collapsed');
    } else {
      mainContent.classList.remove('admin-panel-open');
      mainContent.classList.add('admin-panel-collapsed');
    }
  }
  sidebar.addEventListener('shown.bs.offcanvas', syncState);
  sidebar.addEventListener('hidden.bs.offcanvas', syncState);
  syncState();
