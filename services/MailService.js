function getNodemailerModule() {
  try {
    // Lazy-load keeps application boot independent from optional mail dependency resolution.
    return require('nodemailer');
  } catch (err) {
    const wrapped = new Error(
      'Nodemailer ist nicht installiert. Bitte Abhängigkeiten neu installieren (npm install).'
    );
    wrapped.cause = err;
    throw wrapped;
  }
}

function normalizePort(value, fallback = 587) {
  const parsed = parseInt(String(value || '').trim(), 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }
  return parsed;
}

function trimString(value) {
  return String(value || '').trim();
}

class MailService {
  constructor(models, mailConfigService, mailTemplateService, notificationService) {
    this.models = models;
    this.mailConfigService = mailConfigService;
    this.mailTemplateService = mailTemplateService;
    this.notificationService = notificationService;
    this.smtpTransportCache = {
      key: null,
      transporter: null,
    };
  }

  resolveLocale(value) {
    return String(value || '').toLowerCase() === 'en' ? 'en' : 'de';
  }

  async sendTemplate(templateKey, payload = {}) {
    const locale = this.resolveLocale(payload.locale);
    const email = trimString(payload.email);
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

  validateSmtpConfig(config) {
    const smtpHost = trimString(config.smtpHost);
    if (!smtpHost) {
      const err = new Error('SMTP-Host ist nicht konfiguriert');
      err.status = 422;
      throw err;
    }

    const smtpPort = normalizePort(config.smtpPort, NaN);
    if (!Number.isFinite(smtpPort)) {
      const err = new Error('SMTP-Port ist ungültig');
      err.status = 422;
      throw err;
    }
    const smtpSecure = Boolean(config.smtpSecure);
    if (smtpSecure && smtpPort === 587) {
      const err = new Error('SMTP-Konfiguration ungültig: Port 587 benötigt SMTP Secure=false (STARTTLS).');
      err.status = 422;
      throw err;
    }
    if (!smtpSecure && smtpPort === 465) {
      const err = new Error('SMTP-Konfiguration ungültig: Port 465 benötigt SMTP Secure=true.');
      err.status = 422;
      throw err;
    }

    const smtpUser = trimString(config.smtpUser);
    const smtpPass = trimString(config.smtpPass);
    if (smtpUser && !smtpPass) {
      const err = new Error('SMTP-Passwort fehlt');
      err.status = 422;
      throw err;
    }

    const fromAddress = trimString(config.fromEmail);
    if (!fromAddress) {
      const err = new Error('Absenderadresse ist nicht konfiguriert');
      err.status = 422;
      throw err;
    }

    return {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      fromAddress,
      fromName: trimString(config.fromName),
      replyTo: trimString(config.replyTo),
    };
  }

  mapTransportError(err, config) {
    const rawMessage = String((err && err.message) || '').trim();
    const lower = rawMessage.toLowerCase();
    const smtpPort = normalizePort(config && config.smtpPort, 0);
    const smtpSecure = Boolean(config && config.smtpSecure);

    if (
      lower.includes('wrong version number') ||
      lower.includes('ssl routines:tls_validate_record_header')
    ) {
      if (smtpSecure && smtpPort === 587) {
        return 'SMTP TLS-Fehler: Port 587 benötigt SMTP Secure=false (STARTTLS).';
      }
      if (!smtpSecure && smtpPort === 465) {
        return 'SMTP TLS-Fehler: Port 465 benötigt SMTP Secure=true.';
      }
      return 'SMTP TLS-Handshake fehlgeschlagen. Prüfe Port/Secure-Kombination (587+false oder 465+true).';
    }

    if (
      lower.includes('invalid login') ||
      lower.includes('authentication failed') ||
      lower.includes('535-5.7.8') ||
      lower.includes('535 5.7.8')
    ) {
      return 'SMTP-Authentifizierung fehlgeschlagen. Bei Gmail bitte ein App-Passwort verwenden.';
    }

    return rawMessage || 'Versand fehlgeschlagen';
  }

  buildTransportCacheKey(config) {
    return JSON.stringify({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      user: config.smtpUser,
      pass: config.smtpPass,
    });
  }

  getSmtpTransporter(validatedConfig) {
    const cacheKey = this.buildTransportCacheKey(validatedConfig);
    if (this.smtpTransportCache.transporter && this.smtpTransportCache.key === cacheKey) {
      return this.smtpTransportCache.transporter;
    }

    const nodemailer = getNodemailerModule();
    const transportOptions = {
      host: validatedConfig.smtpHost,
      port: validatedConfig.smtpPort,
      secure: validatedConfig.smtpSecure,
    };
    if (validatedConfig.smtpUser) {
      transportOptions.auth = {
        user: validatedConfig.smtpUser,
        pass: validatedConfig.smtpPass,
      };
    }

    const transporter = nodemailer.createTransport(transportOptions);
    this.smtpTransportCache = {
      key: cacheKey,
      transporter,
    };
    return transporter;
  }

  buildFromField(validatedConfig) {
    if (!validatedConfig.fromName) {
      return validatedConfig.fromAddress;
    }
    return {
      name: validatedConfig.fromName,
      address: validatedConfig.fromAddress,
    };
  }

  async sendViaSmtp({ config, notification }) {
    const validatedConfig = this.validateSmtpConfig(config);
    const transporter = this.getSmtpTransporter(validatedConfig);

    await transporter.sendMail({
      from: this.buildFromField(validatedConfig),
      to: notification.email,
      replyTo: validatedConfig.replyTo || undefined,
      subject: notification.subject,
      text: notification.body || '',
    });
  }

  async dispatchNotification(notificationId) {
    const notification = await this.notificationService.getById(notificationId);
    const config = await this.mailConfigService.getConfig({ createIfMissing: true });
    if (!config || !config.isEnabled) {
      await this.notificationService.markFailed(notification.id, 'Mail-System ist deaktiviert');
      return notification;
    }

    try {
      await this.sendViaSmtp({ config, notification });
      await this.notificationService.markSent(notification.id);
    } catch (err) {
      await this.notificationService.markFailed(
        notification.id,
        this.mapTransportError(err, config)
      );
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
}

module.exports = MailService;
