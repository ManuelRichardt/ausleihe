const {
  services,
  renderPage,
  handleError,
  parseListQuery,
  buildPagination,
} = require('../_controllerUtils');

class PrivacyController {
  async searchUsers(req, res, next) {
    try {
      const q = String(req.query.q || '').trim();
      if (q.length < 2) {
        return res.json({ data: [] });
      }
      const users = await services.userService.searchUsers(
        { query: q },
        {
          limit: 20,
          order: [['lastName', 'ASC'], ['firstName', 'ASC'], ['username', 'ASC']],
        }
      );
      const data = users.map((user) => ({
        id: user.id,
        username: user.username || '',
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
      }));
      return res.json({ data });
    } catch (err) {
      return res.status(500).json({
        data: [],
        error: err && err.message ? err.message : 'Suche fehlgeschlagen',
      });
    }
  }

  async index(req, res, next) {
    try {
      const { page, limit, offset } = parseListQuery(
        req,
        ['createdAt', 'status'],
        { order: [['createdAt', 'DESC']], limit: 20 }
      );
      const status = req.query.status ? String(req.query.status).trim() : '';
      const query = req.query.q ? String(req.query.q).trim() : '';

      const config = await services.privacyService.getConfig({ createIfMissing: true });
      const { rows, count } = await services.privacyService.listDeletionRequests(
        {
          status: status || null,
          query: query || null,
        },
        {
          limit,
          offset,
          order: [['createdAt', 'DESC']],
        }
      );

      return renderPage(res, 'system/privacy/index', req, {
        breadcrumbs: [
          { label: 'System', href: '/system/lending-locations' },
          { label: 'Datenschutz', href: '/system/privacy' },
        ],
        config,
        requests: rows,
        filters: {
          status,
          q: query,
        },
        pagination: buildPagination(page, limit, count),
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async updateConfig(req, res, next) {
    try {
      await services.privacyService.updateConfig({
        isEnabled: req.body.isEnabled === 'on' || req.body.isEnabled === 'true',
        returnedLoanRetentionMonths: req.body.returnedLoanRetentionMonths,
        autoDeleteExternalUsers:
          req.body.autoDeleteExternalUsers === 'on' || req.body.autoDeleteExternalUsers === 'true',
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Datenschutz-Einstellungen gespeichert.');
      }
      return res.redirect('/system/privacy');
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message || 'Einstellungen konnten nicht gespeichert werden.');
      }
      return res.redirect('/system/privacy');
    }
  }

  async createRequest(req, res, next) {
    try {
      await services.privacyService.createDeletionRequest({
        userId: req.body.userId,
        requestedByUserId: req.user ? req.user.id : null,
        requestNote: req.body.requestNote || null,
        metadata: { source: 'system_admin' },
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Löschanfrage wurde erstellt.');
      }
      return res.redirect('/system/privacy');
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message || 'Löschanfrage konnte nicht erstellt werden.');
      }
      return res.redirect('/system/privacy');
    }
  }

  async processRequest(req, res, next) {
    try {
      await services.privacyService.processDeletionRequest(req.params.id, {
        processedByUserId: req.user ? req.user.id : null,
        processNote: req.body.processNote || null,
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Löschanfrage wurde verarbeitet.');
      }
      return res.redirect('/system/privacy');
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message || 'Löschanfrage konnte nicht verarbeitet werden.');
      }
      return res.redirect('/system/privacy');
    }
  }

  async rejectRequest(req, res, next) {
    try {
      await services.privacyService.rejectDeletionRequest(req.params.id, {
        processedByUserId: req.user ? req.user.id : null,
        processNote: req.body.processNote || null,
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Löschanfrage wurde abgelehnt.');
      }
      return res.redirect('/system/privacy');
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message || 'Löschanfrage konnte nicht abgelehnt werden.');
      }
      return res.redirect('/system/privacy');
    }
  }

  async runCleanup(req, res, next) {
    try {
      const result = await services.privacyService.runAutomaticCleanup();
      if (typeof req.flash === 'function') {
        if (result && result.skipped) {
          req.flash('success', 'Automatischer Datenschutz-Cleanup ist deaktiviert.');
        } else {
          req.flash(
            'success',
            `Cleanup ausgeführt: ${result.deletedLoans || 0} Ausleihen, ${result.deletedLoanSignatures || 0} Signaturen, ${result.deletedExternalUsers || 0} externe Benutzer.`
          );
        }
      }
      return res.redirect('/system/privacy');
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message || 'Cleanup konnte nicht ausgeführt werden.');
      }
      return res.redirect('/system/privacy');
    }
  }
}

module.exports = PrivacyController;
