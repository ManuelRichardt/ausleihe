const { spawn } = require('child_process');

class MailService {
  constructor(models, mailConfigService, mailTemplateService, notificationService) {
    this.models = models;
    this.mailConfigService = mailConfigService;
    this.mailTemplateService = mailTemplateService;
    this.notificationService = notificationService;
  }

  resolveLocale(value) {
    return String(value || '').toLowerCase() === 'en' ? 'en' : 'de';
  }

  async sendTemplate(templateKey, payload = {}) {
    const locale = this.resolveLocale(payload.locale);
    const email = String(payload.email || '').trim();
    if (!email) {
      const err = new Error('Empfänger-E-Mail fehlt');
      err.status = 422;
      throw err;
    }

    const template = await this.mailTemplateService.getByKey(templateKey);
    if (!template.isActive) {
      const err = new Error('Mail-Template ist deaktiviert');
      err.status = 422;
      throw err;
    }

    const rendered = this.mailTemplateService.render(template, locale, payload.variables || {});
    const metadataText = payload.metadata ? JSON.stringify(payload.metadata) : null;
    const notification = await this.notificationService.createNotification({
      userId: payload.userId || null,
      email,
      templateKey,
      locale,
      subject: rendered.subject,
      body: rendered.body,
      status: 'pending',
      metadataText,
      scheduledFor: payload.scheduledFor || null,
    });

    if (payload.sendNow !== false) {
      await this.dispatchNotification(notification.id);
    }

    return notification;
  }

  async dispatchNotification(notificationId) {
    const notification = await this.notificationService.getById(notificationId);
    const config = await this.mailConfigService.getConfig({ createIfMissing: true });
    if (!config || !config.isEnabled) {
      await this.notificationService.markFailed(notification.id, 'Mail-System ist deaktiviert');
      return notification;
    }
    if (config.transport !== 'sendmail') {
      await this.notificationService.markFailed(notification.id, 'Nicht unterstützter Mail-Transport');
      return notification;
    }

    const fromAddress = String(config.fromEmail || '').trim();
    if (!fromAddress) {
      await this.notificationService.markFailed(notification.id, 'Absenderadresse ist nicht konfiguriert');
      return notification;
    }

    try {
      await this.sendViaSendmail({
        sendmailPath: config.sendmailPath || '/usr/sbin/sendmail',
        fromEmail: fromAddress,
        fromName: config.fromName || '',
        replyTo: config.replyTo || '',
        to: notification.email,
        subject: notification.subject,
        body: notification.body,
      });
      await this.notificationService.markSent(notification.id);
    } catch (err) {
      await this.notificationService.markFailed(notification.id, err.message || 'Versand fehlgeschlagen');
    }
    return notification;
  }

  async processPending(limit = 100) {
    const pending = await this.notificationService.listPending(limit);
    for (const notification of pending) {
      await this.dispatchNotification(notification.id);
    }
    return pending.length;
  }

  async hasNotificationForLoan(templateKey, loanId) {
    const pattern = `%\"loanId\":\"${String(loanId)}\"%`;
    const existing = await this.models.Notification.findOne({
      where: {
        templateKey,
        metadataText: { [this.models.Sequelize.Op.like]: pattern },
        status: ['pending', 'sent'],
      },
    });
    return Boolean(existing);
  }

  async queueAutomaticReminders(options = {}) {
    const now = new Date();
    const next24h = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    const created = {
      pickup: 0,
      return: 0,
      overdue: 0,
    };

    const reserved = await this.models.Loan.findAll({
      where: {
        status: 'reserved',
        reservedFrom: {
          [this.models.Sequelize.Op.gte]: now,
          [this.models.Sequelize.Op.lte]: next24h,
        },
      },
      include: [
        { model: this.models.User, as: 'user' },
        { model: this.models.LendingLocation, as: 'lendingLocation' },
      ],
      limit: options.limit || 200,
    });
    for (const loan of reserved) {
      if (!loan.user || !loan.user.email) {
        continue;
      }
      if (await this.hasNotificationForLoan('pickup_reminder', loan.id)) {
        continue;
      }
      await this.sendTemplate('pickup_reminder', {
        userId: loan.user.id,
        email: loan.user.email,
        locale: loan.user.locale || 'de',
        sendNow: false,
        variables: {
          firstName: loan.user.firstName || loan.user.username || '',
          loanId: loan.id,
          lendingLocation: loan.lendingLocation ? loan.lendingLocation.name : '-',
          reservedFrom: loan.reservedFrom,
          reservedUntil: loan.reservedUntil,
        },
        metadata: {
          type: 'pickup_reminder',
          loanId: loan.id,
        },
      });
      created.pickup += 1;
    }

    const handedOver = await this.models.Loan.findAll({
      where: {
        status: ['handed_over', 'overdue'],
      },
      include: [
        { model: this.models.User, as: 'user' },
        { model: this.models.LendingLocation, as: 'lendingLocation' },
      ],
      limit: options.limit || 200,
    });
    for (const loan of handedOver) {
      if (!loan.user || !loan.user.email) {
        continue;
      }
      if (loan.reservedUntil && new Date(loan.reservedUntil).getTime() < now.getTime()) {
        if (await this.hasNotificationForLoan('overdue_notice', loan.id)) {
          continue;
        }
        await this.sendTemplate('overdue_notice', {
          userId: loan.user.id,
          email: loan.user.email,
          locale: loan.user.locale || 'de',
          sendNow: false,
          variables: {
            firstName: loan.user.firstName || loan.user.username || '',
            loanId: loan.id,
            lendingLocation: loan.lendingLocation ? loan.lendingLocation.name : '-',
            reservedUntil: loan.reservedUntil,
          },
          metadata: {
            type: 'overdue_notice',
            loanId: loan.id,
          },
        });
        created.overdue += 1;
        continue;
      }

      if (loan.reservedUntil) {
        const until = new Date(loan.reservedUntil);
        if (until.getTime() >= now.getTime() && until.getTime() <= next24h.getTime()) {
          if (await this.hasNotificationForLoan('return_reminder', loan.id)) {
            continue;
          }
          await this.sendTemplate('return_reminder', {
            userId: loan.user.id,
            email: loan.user.email,
            locale: loan.user.locale || 'de',
            sendNow: false,
            variables: {
              firstName: loan.user.firstName || loan.user.username || '',
              loanId: loan.id,
              lendingLocation: loan.lendingLocation ? loan.lendingLocation.name : '-',
              reservedUntil: loan.reservedUntil,
            },
            metadata: {
              type: 'return_reminder',
              loanId: loan.id,
            },
          });
          created.return += 1;
        }
      }
    }

    return created;
  }

  async sendViaSendmail(payload = {}) {
    return new Promise((resolve, reject) => {
      const sendmailPath = payload.sendmailPath || '/usr/sbin/sendmail';
      const child = spawn(sendmailPath, ['-t', '-i']);
      const fromHeader = payload.fromName
        ? `"${String(payload.fromName).replace(/\"/g, '')}" <${payload.fromEmail}>`
        : payload.fromEmail;

      const headers = [
        `From: ${fromHeader}`,
        `To: ${payload.to}`,
        payload.replyTo ? `Reply-To: ${payload.replyTo}` : '',
        `Subject: ${payload.subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
      ].filter(Boolean).join('\n');

      const message = `${headers}\n\n${payload.body || ''}\n`;

      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        reject(err);
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr.trim() || `sendmail exited with code ${code}`));
      });

      child.stdin.write(message);
      child.stdin.end();
    });
  }
}

module.exports = MailService;
