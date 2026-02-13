const { services, renderPage, handleError } = require('../_controllerUtils');
const { formatDateTime } = require('../../../utils/dateFormat');
const SignatureService = require('../../../services/SignatureService');
const models = require('../../../models');

class LoanAdminController {
  constructor() {
    this.signatureService = new SignatureService(models);
  }

  async index(req, res, next) {
    try {
      const hasStatusFilter = Object.prototype.hasOwnProperty.call(req.query || {}, 'status');
      const statusFilter = hasStatusFilter ? (req.query.status || undefined) : 'reserved';
      const loans = await services.loanPortalService.listForAdmin(req.lendingLocationId, {
        status: statusFilter,
      });
      const statusTitles = {
        reserved: 'Offene Ausleihen',
        handed_over: 'Aktive Ausleihen',
        overdue: 'Überfällige Ausleihen',
        returned: 'Zurückgegebene Ausleihen',
      };
      const query = {
        ...(req.query || {}),
      };
      if (!hasStatusFilter) {
        query.status = 'reserved';
      }
      return renderPage(res, 'loans/admin/index', req, {
        pageTitle: 'Aktive Ausleihen',
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: statusTitles[query.status] || 'Ausleihen', href: '/admin/loans' },
        ],
        loans,
        query,
        activeStatus: query.status || '',
        heading: statusTitles[query.status] || 'Ausleihen',
        formatDateTime,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async show(req, res, next) {
    try {
      const { loan, assetsByModelId, assetModels } =
        await services.loanPortalService.getAdminContext(req.params.id, req.lendingLocationId);
      return renderPage(res, 'loans/admin/show', req, {
        pageTitle: 'Ausleihdetails',
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Aktive Ausleihen', href: '/admin/loans' },
          { label: 'Details', href: `/admin/loans/${loan.id}` },
        ],
        loan,
        assetsByModelId,
        assetModels,
        formatDateTime,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async showReturn(req, res, next) {
    try {
      const { loan, assetsByModelId, assetModels } =
        await services.loanPortalService.getAdminContext(req.params.id, req.lendingLocationId);
      return renderPage(res, 'loans/admin/return', req, {
        pageTitle: 'Rücknahme',
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Aktive Ausleihen', href: '/admin/loans' },
          { label: 'Rücknahme', href: `/admin/loans/${loan.id}/return` },
        ],
        loan,
        assetsByModelId,
        assetModels,
        formatDateTime,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async handOver(req, res, next) {
    try {
      await services.loanPortalService.handOver(req.params.id, req.lendingLocationId, {
        ...req.body,
        userId: req.user.id,
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Ausleihe wurde übergeben.');
      }
      return res.redirect('/admin/loans');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async returnLoan(req, res, next) {
    try {
      await services.loanPortalService.returnLoan(req.params.id, req.lendingLocationId, {
        ...req.body,
        userId: req.user.id,
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Ausleihe wurde zurückgenommen.');
      }
      return res.redirect(`/admin/loans/${req.params.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async returnItems(req, res, next) {
    try {
      const signatureBase64 = req.body.signatureBase64;
      const signedByName = (req.body.signedByName && String(req.body.signedByName).trim())
        || [req.user.firstName, req.user.lastName].filter(Boolean).join(' ')
        || req.user.username;

      if (!signatureBase64) {
        if (typeof req.flash === 'function') {
          req.flash('error', 'Unterschrift für die Rücknahme ist erforderlich.');
        }
        return res.redirect(`/admin/loans/${req.params.id}/return`);
      }

      this.signatureService.validateSignature(signatureBase64);

      await services.loanPortalService.returnItems(req.params.id, req.lendingLocationId, {
        itemIds: req.body.itemIds,
        items: req.body.items,
        note: req.body.note || null,
        userId: req.user.id,
        returnedAt: new Date(),
      });

      await this.signatureService.createFromBase64({
        loanId: req.params.id,
        userId: req.user.id,
        signatureType: 'return',
        signedByName,
        signedAt: req.body.signedAt || new Date(),
        base64: signatureBase64,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          source: 'admin.return-items',
        },
      });

      if (typeof req.flash === 'function') {
        req.flash('success', 'Ausgewählte Items wurden zurückgenommen.');
      }
      return res.redirect(`/admin/loans/${req.params.id}`);
    } catch (err) {
      if (err && err.message && err.message.toLowerCase().includes('signature')) {
        if (typeof req.flash === 'function') {
          req.flash('error', err.message);
        }
        return res.redirect(`/admin/loans/${req.params.id}/return`);
      }
      if (err && err.message && err.message.toLowerCase().includes('at least one item')) {
        if (typeof req.flash === 'function') {
          req.flash('error', 'Bitte mindestens ein Item auswählen.');
        }
        return res.redirect(`/admin/loans/${req.params.id}/return`);
      }
      return handleError(res, next, req, err);
    }
  }

  async addItem(req, res, next) {
    try {
      await services.loanPortalService.addItems(req.params.id, req.lendingLocationId, {
        assetModelId: req.body.assetModelId,
        quantity: req.body.quantity,
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Items wurden hinzugefügt.');
      }
      return res.redirect(`/admin/loans/${req.params.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async updatePeriod(req, res, next) {
    try {
      await services.loanPortalService.updatePeriod(req.params.id, req.lendingLocationId, {
        reservedFrom: req.body.reservedFrom,
        reservedUntil: req.body.reservedUntil,
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Ausleihzeitraum aktualisiert.');
      }
      return res.redirect(`/admin/loans/${req.params.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async updateItemModel(req, res, next) {
    try {
      await services.loanPortalService.updateItemModel(
        req.params.id,
        req.lendingLocationId,
        req.params.itemId,
        req.body.assetModelId
      );
      if (typeof req.flash === 'function') {
        req.flash('success', 'Modell wurde geändert.');
      }
      return res.redirect(`/admin/loans/${req.params.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async searchModels(req, res, next) {
    try {
      const results = await services.loanPortalService.searchModels(req.lendingLocationId, req.query.q);
      return res.json({ data: results, error: null });
    } catch (err) {
      return next(err);
    }
  }

  async removeItem(req, res, next) {
    try {
      await services.loanPortalService.removeItem(
        req.params.id,
        req.lendingLocationId,
        req.params.itemId
      );
      if (typeof req.flash === 'function') {
        req.flash('success', 'Item wurde entfernt.');
      }
      return res.redirect(`/admin/loans/${req.params.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = LoanAdminController;
