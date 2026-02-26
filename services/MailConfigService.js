function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'ja'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off', 'nein'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function trimToNull(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function normalizePort(value, fallback = 587) {
  const asNumber = parseInt(String(value || '').trim(), 10);
  if (Number.isNaN(asNumber) || asNumber < 1 || asNumber > 65535) {
    return fallback;
  }
  return asNumber;
}

class MailConfigService {
  constructor(models) {
    this.models = models;
    this._schemaReadyPromise = null;
  }

  getDefaultConfigFromEnv() {
    return {
      isEnabled: false,
      transport: 'smtp',
      fromEmail: String(process.env.MAIL_FROM_EMAIL || '').trim(),
      fromName: String(process.env.MAIL_FROM_NAME || '').trim(),
      replyTo: String(process.env.MAIL_REPLY_TO || '').trim(),
      smtpHost: String(process.env.SMTP_HOST || '').trim(),
      smtpPort: normalizePort(process.env.SMTP_PORT, 587),
      smtpSecure: parseBoolean(process.env.SMTP_SECURE, false),
      smtpUser: String(process.env.SMTP_USER || '').trim(),
      smtpPass: String(process.env.SMTP_PASS || '').trim(),
      sendmailPath: '/usr/sbin/sendmail',
    };
  }

  async ensureSchema() {
    if (!this._schemaReadyPromise) {
      this._schemaReadyPromise = this.ensureSchemaInternal().catch((err) => {
        this._schemaReadyPromise = null;
        throw err;
      });
    }
    return this._schemaReadyPromise;
  }

  async ensureSchemaInternal() {
    const queryInterface = this.models.sequelize.getQueryInterface();
    let columns;
    try {
      columns = await queryInterface.describeTable('mail_configs');
    } catch (err) {
      // Fresh setup: table may not exist until installation sync runs.
      return;
    }

    const ensureColumn = async (columnName, spec) => {
      if (columns[columnName]) {
        return;
      }
      await queryInterface.addColumn('mail_configs', columnName, spec);
      columns[columnName] = spec;
    };

    await ensureColumn('smtp_host', {
      type: this.models.Sequelize.STRING(191),
      allowNull: true,
    });
    await ensureColumn('smtp_port', {
      type: this.models.Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 587,
    });
    await ensureColumn('smtp_secure', {
      type: this.models.Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await ensureColumn('smtp_user', {
      type: this.models.Sequelize.STRING(191),
      allowNull: true,
    });
    await ensureColumn('smtp_pass', {
      type: this.models.Sequelize.STRING(255),
      allowNull: true,
    });

    await this.ensureTransportEnumSupportsSmtp();
    await this.models.sequelize.query(`
      UPDATE mail_configs
      SET transport = 'smtp'
      WHERE transport = 'sendmail'
    `);
  }

  async ensureTransportEnumSupportsSmtp() {
    const dialect = this.models.sequelize.getDialect();
    if (!['mariadb', 'mysql'].includes(dialect)) {
      return;
    }

    await this.models.sequelize.query(`
      ALTER TABLE mail_configs
      MODIFY COLUMN transport ENUM('smtp', 'sendmail') NOT NULL DEFAULT 'smtp'
    `);
  }

  async getConfig(options = {}) {
    await this.ensureSchema();

    let config = await this.models.MailConfig.findOne({
      order: [['createdAt', 'ASC']],
      transaction: options.transaction,
    });

    if (!config && options.createIfMissing !== false) {
      config = await this.models.MailConfig.create(this.getDefaultConfigFromEnv(), {
        transaction: options.transaction,
      });
    }

    return config;
  }

  async updateConfig(data = {}) {
    const config = await this.getConfig({ createIfMissing: true });

    const nextSmtpUser =
      data.smtpUser !== undefined ? trimToNull(data.smtpUser) : trimToNull(config.smtpUser);
    let nextSmtpPass = trimToNull(config.smtpPass);

    if (data.smtpPass !== undefined) {
      const incomingPassword = String(data.smtpPass || '');
      if (incomingPassword.trim()) {
        nextSmtpPass = incomingPassword;
      } else if (!nextSmtpUser) {
        nextSmtpPass = null;
      }
    }

    await config.update({
      isEnabled: data.isEnabled !== undefined ? Boolean(data.isEnabled) : config.isEnabled,
      transport: 'smtp',
      fromEmail: data.fromEmail !== undefined ? String(data.fromEmail || '').trim() : config.fromEmail,
      fromName: data.fromName !== undefined ? String(data.fromName || '').trim() : config.fromName,
      replyTo: data.replyTo !== undefined ? String(data.replyTo || '').trim() : config.replyTo,
      smtpHost: data.smtpHost !== undefined ? String(data.smtpHost || '').trim() : config.smtpHost,
      smtpPort: data.smtpPort !== undefined
        ? normalizePort(data.smtpPort, normalizePort(config.smtpPort, 587))
        : normalizePort(config.smtpPort, 587),
      smtpSecure: data.smtpSecure !== undefined ? Boolean(data.smtpSecure) : Boolean(config.smtpSecure),
      smtpUser: nextSmtpUser,
      smtpPass: nextSmtpPass,
    });

    return config;
  }
}

module.exports = MailConfigService;
