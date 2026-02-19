const { services, renderPage, handleError } = require('../controllerUtils');
const { formatDateTime } = require('../../../utils/dateFormat');

class UserLoanController {
  async index(req, res, next) {
    try {
      const loans = await services.loanPortalService.listForUser(req.user.id, {
        status: req.query.status || undefined,
      });
      return renderPage(res, 'loans/user/index', req, {
        pageTitle: 'Meine Ausleihen',
        breadcrumbs: [{ label: 'Meine Ausleihen', href: '/loans' }],
        loans,
        formatDateTime,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async show(req, res, next) {
    try {
      const loan = await services.loanPortalService.getForUser(req.params.id, req.user.id);
      return renderPage(res, 'loans/user/show', req, {
        pageTitle: 'Ausleihdetails',
        breadcrumbs: [
          { label: 'Meine Ausleihen', href: '/loans' },
          { label: 'Details', href: `/loans/${loan.id}` },
        ],
        loan,
        formatDateTime,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = UserLoanController;
