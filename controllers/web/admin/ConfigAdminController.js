const { services, renderPage, handleError } = require('../controllerUtils');

class ConfigAdminController {
  async openingHours(req, res, next) {
    try {
    const hours = await services.openingHourService.getAllRegularHours(req.lendingLocationId);
    const exceptions = await services.openingHourService.getAllExceptions(req.lendingLocationId);
      return renderPage(res, 'admin/config/openingHours', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Opening Hours', href: '/admin/opening-hours' },
        ],
        hours,
        exceptions,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async settings(req, res, next) {
    try {
      const locations = await services.lendingLocationService.getAll({});
      return renderPage(res, 'admin/config/settings', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Settings', href: '/admin/settings' },
        ],
        locations,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = ConfigAdminController;
