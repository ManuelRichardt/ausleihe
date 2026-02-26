const { services, renderPage, handleError, parseListQuery, buildPagination } = require('../controllerUtils');

class MailAdminController {
  async index(req, res, next) {
    try {
      await services.mailTemplateService.ensureDefaults();
      const { page, limit, offset } = parseListQuery(req, ['createdAt'], { order: [['createdAt', 'DESC']], limit: 20 });
      const total = await services.models.Notification.count();
      const notifications = await services.notificationService.list({}, {
        limit,
        offset,
      });
      const config = await services.mailConfigService.getConfig({ createIfMissing: true });
      const templates = await services.mailTemplateService.list();
      return renderPage(res, 'system/mail/index', req, {
        breadcrumbs: [
          { label: 'System', href: '/system/lending-locations' },
          { label: 'Mail', href: '/system/mail' },
        ],
        config,
        templates,
        notifications,
        pagination: buildPagination(page, limit, total),
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async updateConfig(req, res, next) {
    try {
      await services.mailConfigService.updateConfig({
        isEnabled: req.body.isEnabled === 'on' || req.body.isEnabled === 'true',
        transport: 'smtp',
        fromEmail: req.body.fromEmail,
        fromName: req.body.fromName,
        replyTo: req.body.replyTo,
        smtpHost: req.body.smtpHost,
        smtpPort: req.body.smtpPort,
        smtpSecure: req.body.smtpSecure === 'on' || req.body.smtpSecure === 'true',
        smtpUser: req.body.smtpUser,
        smtpPass: req.body.smtpPass,
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Mail-Konfiguration gespeichert');
      }
      return res.redirect('/system/mail');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async editTemplate(req, res, next) {
    try {
      const template = await services.mailTemplateService.getById(req.params.id);
      return renderPage(res, 'system/mail/templateEdit', req, {
        breadcrumbs: [
          { label: 'System', href: '/system/lending-locations' },
          { label: 'Mail', href: '/system/mail' },
          { label: template.key, href: `/system/mail/templates/${template.id}/edit` },
        ],
        template,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async updateTemplate(req, res, next) {
    try {
      await services.mailTemplateService.update(req.params.id, {
        key: req.body.key,
        subjectDe: req.body.subjectDe,
        subjectEn: req.body.subjectEn,
        bodyDe: req.body.bodyDe,
        bodyEn: req.body.bodyEn,
        isActive: req.body.isActive === 'on' || req.body.isActive === 'true',
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Mail-Template gespeichert');
      }
      return res.redirect('/system/mail');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async sendTest(req, res, next) {
    try {
      const email = String(req.body.email || '').trim();
      if (!email) {
        const err = new Error('E-Mail ist erforderlich');
        err.status = 422;
        throw err;
      }
      await services.mailService.sendTemplate('reservation_confirmation', {
        email,
        locale: req.locale || 'de',
        variables: {
          firstName: 'Test',
          loanId: 'TEST-123',
          lendingLocation: 'Testausleihe',
          reservedFrom: '-',
          reservedUntil: '-',
        },
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Testmail wurde versendet');
      }
      return res.redirect('/system/mail');
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message || 'Testmail fehlgeschlagen');
      }
      return handleError(res, next, req, err);
    }
  }

  async processPending(req, res, next) {
    try {
      const processed = await services.mailService.processPending(100);
      if (typeof req.flash === 'function') {
        req.flash('success', `${processed} Benachrichtigungen verarbeitet`);
      }
      return res.redirect('/system/mail');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async queueReminders(req, res, next) {
    try {
      const result = await services.mailService.queueAutomaticReminders({ limit: 300 });
      if (typeof req.flash === 'function') {
        req.flash('success', `Reminder erstellt: Abholung ${result.pickup}, Rückgabe ${result.return}, Überfällig ${result.overdue}`);
      }
      return res.redirect('/system/mail');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = MailAdminController;
