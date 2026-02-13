const { renderPage, handleError } = require('./_controllerUtils');

class HomeController {
  async index(req, res, next) {
    try {
      if (req.user) {
        return res.redirect('/dashboard');
      }
      return renderPage(res, 'landing', req, {
        breadcrumbs: [{ label: 'Home', href: '/' }],
        showHeader: false,
        showSidebar: false,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = HomeController;
