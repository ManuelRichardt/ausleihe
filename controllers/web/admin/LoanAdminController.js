const { services, renderPage, handleError } = require('../controllerUtils');
const { formatDateTime } = require('../../../utils/dateFormat');
const SignatureService = require('../../../services/SignatureService');
const models = require('../../../models');

const RETURN_ITEM_REDIRECT = Object.freeze({
  form: (loanId) => `/admin/loans/${loanId}/return`,
  detail: (loanId) => `/admin/loans/${loanId}`,
});

const KNOWN_RETURN_ERROR_HANDLERS = Object.freeze([
  {
    matcher: 'signature',
    message: (err) => err.message,
    redirectTo: (loanId) => RETURN_ITEM_REDIRECT.form(loanId),
  },
  {
    matcher: 'at least one item',
    message: () => 'Bitte mindestens ein Item auswählen.',
    redirectTo: (loanId) => RETURN_ITEM_REDIRECT.form(loanId),
  },
]);

class LoanAdminController {
  constructor() {
    this.signatureService = new SignatureService(models);
  }

  resolveSignedAt(rawSignedAt) {
    const now = new Date();
    if (!rawSignedAt) {
      return now;
    }
    const raw = String(rawSignedAt).trim();
    if (!raw) {
      return now;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return now;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return now;
    }
    return parsed;
  }

  resolveSignedByName(req) {
    return (req.body.signedByName && String(req.body.signedByName).trim())
      || [req.user.firstName, req.user.lastName].filter(Boolean).join(' ')
      || req.user.username;
  }

  handleKnownReturnErrors(err, req, res) {
    const errMessage = String((err && err.message) || '').toLowerCase();
    if (!errMessage) {
      return false;
    }
    const knownErrorHandler = KNOWN_RETURN_ERROR_HANDLERS.find((entry) => errMessage.includes(entry.matcher));
    if (!knownErrorHandler) {
      return false;
    }
    if (typeof req.flash === 'function') {
      req.flash('error', knownErrorHandler.message(err));
    }
    res.redirect(knownErrorHandler.redirectTo(req.params.id));
    return true;
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
        today_returns: 'Heute fällige Rückgaben',
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
      const signedByName = this.resolveSignedByName(req);

      if (!signatureBase64) {
        if (typeof req.flash === 'function') {
          req.flash('error', 'Unterschrift für die Rücknahme ist erforderlich.');
        }
        return res.redirect(RETURN_ITEM_REDIRECT.form(req.params.id));
      }

      // Signature is validated before item return to enforce legal proof requirements.
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
        signedAt: this.resolveSignedAt(req.body.signedAt),
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
      return res.redirect(RETURN_ITEM_REDIRECT.detail(req.params.id));
    } catch (err) {
      if (this.handleKnownReturnErrors(err, req, res)) {
        return null;
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
