class MailConfigService {
  constructor(models) {
    this.models = models;
  }

  async getConfig(options = {}) {
    let config = await this.models.MailConfig.findOne({
      order: [['createdAt', 'ASC']],
      transaction: options.transaction,
    });
    if (!config && options.createIfMissing !== false) {
      config = await this.models.MailConfig.create(
        {
          isEnabled: false,
          transport: 'sendmail',
          fromEmail: '',
          fromName: '',
          replyTo: '',
          sendmailPath: '/usr/sbin/sendmail',
        },
        { transaction: options.transaction }
      );
    }
    return config;
  }

  async updateConfig(data = {}) {
    const config = await this.getConfig({ createIfMissing: true });
    await config.update({
      isEnabled: data.isEnabled !== undefined ? Boolean(data.isEnabled) : config.isEnabled,
      transport: data.transport || config.transport || 'sendmail',
      fromEmail: data.fromEmail !== undefined ? String(data.fromEmail || '').trim() : config.fromEmail,
      fromName: data.fromName !== undefined ? String(data.fromName || '').trim() : config.fromName,
      replyTo: data.replyTo !== undefined ? String(data.replyTo || '').trim() : config.replyTo,
      sendmailPath: data.sendmailPath ? String(data.sendmailPath).trim() : (config.sendmailPath || '/usr/sbin/sendmail'),
    });
    return config;
  }
}

module.exports = MailConfigService;
