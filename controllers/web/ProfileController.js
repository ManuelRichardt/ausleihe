const { services, renderPage, handleError } = require('./_controllerUtils');

class ProfileController {
  async show(req, res, next) {
    try {
      if (!req.user) {
        return res.redirect('/login');
      }
      const user = await services.userService.getById(req.user.id);
      const userRoles = await services.userService.listUserRoles(req.user.id);

      return renderPage(res, 'profile/show', req, {
        breadcrumbs: [{ label: 'Profil', href: '/profile' }],
        profileUser: user,
        userRoles,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = ProfileController;
