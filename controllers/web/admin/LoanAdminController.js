const { services, renderPage, handleError } = require('../controllerUtils');
const { formatDateTime } = require('../../../utils/dateFormat');
const SignatureService = require('../../../services/SignatureService');
const models = require('../../../models');
const { LOAN_ITEM_STATUS } = require('../../../config/dbConstants');

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

const RETURNABLE_LOAN_ITEM_STATUSES = Object.freeze([
  LOAN_ITEM_STATUS.RESERVED,
  LOAN_ITEM_STATUS.HANDED_OVER,
]);

class LoanAdminController {
  constructor() {
    this.signatureService = new SignatureService(models);
  }

  buildNewLoanDefaults() {
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    return {
      borrowerType: 'existing',
      userId: '',
      borrowerQuery: '',
      guestFirstName: '',
      guestLastName: '',
      guestEmail: '',
      reservedFrom: start.toISOString().slice(0, 16),
      reservedUntil: end.toISOString().slice(0, 16),
      notes: '',
    };
  }

  parseSelectedItems(raw) {
    const normalizeQuantity = (value) => {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
    };
    const normalizeEntry = (entry) => {
      if (!entry) {
        return null;
      }
      if (typeof entry === 'string') {
        return { kind: 'serialized', assetId: entry };
      }
      if (typeof entry !== 'object') {
        return null;
      }
      const kind = String(entry.kind || '').toLowerCase();
      if (kind === 'bulk' || entry.trackingType === 'bulk' || (!entry.assetId && entry.assetModelId)) {
        const assetModelId = entry.assetModelId || entry.modelId || entry.id || null;
        if (!assetModelId) {
          return null;
        }
        return {
          kind: 'bulk',
          assetModelId,
          quantity: normalizeQuantity(entry.quantity),
          inventoryNumber: entry.inventoryNumber || '',
          serialNumber: entry.serialNumber || '',
          modelName: entry.modelName || '',
          manufacturerName: entry.manufacturerName || '',
        };
      }
      return {
        kind: 'serialized',
        assetId: entry.assetId || entry.id || null,
        inventoryNumber: entry.inventoryNumber || '',
        serialNumber: entry.serialNumber || '',
        modelName: entry.modelName || '',
        manufacturerName: entry.manufacturerName || '',
      };
    };

    if (Array.isArray(raw)) {
      return raw
        .map(normalizeEntry)
        .filter(Boolean)
        .filter((entry) => (entry.kind === 'bulk' ? entry.assetModelId : entry.assetId));
    }
    if (raw && typeof raw === 'object') {
      const normalized = normalizeEntry(raw);
      return normalized ? [normalized] : [];
    }
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return this.parseSelectedItems(parsed);
    } catch (err) {
      return [];
    }
  }

  parseAssetIds(rawAssetIds) {
    if (!rawAssetIds) {
      return [];
    }
    const values = Array.isArray(rawAssetIds) ? rawAssetIds : [rawAssetIds];
    return values
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .map((assetId) => ({ assetId }));
  }

  validateCreateLoanInput(formData, selectedItems) {
    const errors = {};
    if (!formData.reservedFrom) {
      errors.reservedFrom = 'Von ist erforderlich';
    }
    if (!formData.reservedUntil) {
      errors.reservedUntil = 'Bis ist erforderlich';
    }
    const fromDate = formData.reservedFrom ? new Date(formData.reservedFrom) : null;
    const untilDate = formData.reservedUntil ? new Date(formData.reservedUntil) : null;
    if (fromDate && untilDate && !Number.isNaN(fromDate.getTime()) && !Number.isNaN(untilDate.getTime())) {
      if (untilDate <= fromDate) {
        errors.reservedUntil = 'Bis muss nach Von liegen';
      }
    }

    if (formData.borrowerType === 'guest') {
      if (!formData.guestFirstName) {
        errors.guestFirstName = 'Vorname ist erforderlich';
      }
      if (!formData.guestLastName) {
        errors.guestLastName = 'Nachname ist erforderlich';
      }
      if (!formData.guestEmail) {
        errors.guestEmail = 'E-Mail ist erforderlich';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guestEmail)) {
        errors.guestEmail = 'E-Mail ist ungültig';
      }
    } else if (!formData.userId) {
      errors.userId = 'Bitte Benutzer auswählen';
    }

    if (!selectedItems.length) {
      errors.selectedAssets = 'Bitte mindestens ein Asset hinzufügen';
    }

    return errors;
  }

  async new(req, res, next) {
    try {
      return renderPage(res, 'loans/admin/new', req, {
        pageTitle: 'Ausleihe erstellen',
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Ausleihen', href: '/admin/loans' },
          { label: 'Neue Ausleihe', href: '/admin/loans/new' },
        ],
        formData: this.buildNewLoanDefaults(),
        selectedAssets: [],
        errors: {},
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      const formData = {
        borrowerType: String(req.body.borrowerType || 'existing') === 'guest' ? 'guest' : 'existing',
        userId: String(req.body.userId || '').trim(),
        borrowerQuery: String(req.body.borrowerQuery || '').trim(),
        guestFirstName: String(req.body.guestFirstName || '').trim(),
        guestLastName: String(req.body.guestLastName || '').trim(),
        guestEmail: String(req.body.guestEmail || '').trim(),
        reservedFrom: String(req.body.reservedFrom || '').trim(),
        reservedUntil: String(req.body.reservedUntil || '').trim(),
        notes: String(req.body.notes || '').trim(),
      };
      let selectedAssets = this.parseSelectedItems(req.body.selectedAssetsJson);
      if (!selectedAssets.length) {
        selectedAssets = this.parseAssetIds(req.body.assetIds);
      }
      const errors = this.validateCreateLoanInput(formData, selectedAssets);
      if (Object.keys(errors).length) {
        res.status(422);
        return renderPage(res, 'loans/admin/new', req, {
          pageTitle: 'Ausleihe erstellen',
          breadcrumbs: [
            { label: 'Admin', href: '/admin/assets' },
            { label: 'Ausleihen', href: '/admin/loans' },
            { label: 'Neue Ausleihe', href: '/admin/loans/new' },
          ],
          formData,
          selectedAssets,
          errors,
        });
      }

      const loan = await services.loanPortalService.createForAdmin(req.lendingLocationId, {
        userId: formData.borrowerType === 'existing' ? formData.userId : null,
        guestFirstName: formData.borrowerType === 'guest' ? formData.guestFirstName : null,
        guestLastName: formData.borrowerType === 'guest' ? formData.guestLastName : null,
        guestEmail: formData.borrowerType === 'guest' ? formData.guestEmail : null,
        reservedFrom: formData.reservedFrom,
        reservedUntil: formData.reservedUntil,
        notes: formData.notes || null,
        items: selectedAssets.map((entry) => {
          if (entry.kind === 'bulk') {
            return {
              kind: 'bulk',
              assetModelId: entry.assetModelId,
              quantity: entry.quantity,
            };
          }
          return {
            kind: 'serialized',
            assetId: entry.assetId || entry.id,
            quantity: 1,
          };
        }),
      });

      if (typeof req.flash === 'function') {
        req.flash('success', 'Ausleihe wurde erstellt.');
      }
      return res.redirect(`/admin/loans/${loan.id}`);
    } catch (err) {
      const formData = {
        borrowerType: String(req.body.borrowerType || 'existing') === 'guest' ? 'guest' : 'existing',
        userId: String(req.body.userId || '').trim(),
        borrowerQuery: String(req.body.borrowerQuery || '').trim(),
        guestFirstName: String(req.body.guestFirstName || '').trim(),
        guestLastName: String(req.body.guestLastName || '').trim(),
        guestEmail: String(req.body.guestEmail || '').trim(),
        reservedFrom: String(req.body.reservedFrom || '').trim(),
        reservedUntil: String(req.body.reservedUntil || '').trim(),
        notes: String(req.body.notes || '').trim(),
      };
      let selectedAssets = this.parseSelectedItems(req.body.selectedAssetsJson);
      if (!selectedAssets.length) {
        selectedAssets = this.parseAssetIds(req.body.assetIds);
      }
      const message = err && err.message ? err.message : 'Ausleihe konnte nicht erstellt werden';
      const status = err && (err.status || err.statusCode);
      if (!status || status === 422) {
        res.status(422);
        return renderPage(res, 'loans/admin/new', req, {
          pageTitle: 'Ausleihe erstellen',
          breadcrumbs: [
            { label: 'Admin', href: '/admin/assets' },
            { label: 'Ausleihen', href: '/admin/loans' },
            { label: 'Neue Ausleihe', href: '/admin/loans/new' },
          ],
          formData,
          selectedAssets,
          errors: {
            form: message,
          },
        });
      }
      return handleError(res, next, req, err);
    }
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
      const returnableLoanItems = Array.isArray(loan.loanItems)
        ? loan.loanItems.filter((item) => item && RETURNABLE_LOAN_ITEM_STATUSES.includes(item.status))
        : [];
      if (typeof loan.setDataValue === 'function') {
        loan.setDataValue('loanItems', returnableLoanItems);
      }
      loan.loanItems = returnableLoanItems;
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

  async searchUsers(req, res, next) {
    try {
      const results = await services.loanPortalService.searchUsers(req.query.q);
      return res.json({ data: results, error: null });
    } catch (err) {
      return next(err);
    }
  }

  async searchAssets(req, res, next) {
    try {
      const results = await services.loanPortalService.searchAssets(req.lendingLocationId, req.query.q);
      return res.json({ data: results, error: null });
    } catch (err) {
      return next(err);
    }
  }

  async listAssetCodes(req, res, next) {
    try {
      const results = await services.loanPortalService.listAssetCodes(
        req.lendingLocationId,
        req.query.limit
      );
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
