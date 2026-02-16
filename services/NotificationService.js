const { Op } = require('sequelize');

class NotificationService {
  constructor(models) {
    this.models = models;
  }

  async createNotification(data = {}, options = {}) {
    return this.models.Notification.create(
      {
        userId: data.userId || null,
        email: String(data.email || '').trim(),
        templateKey: data.templateKey || 'custom',
        locale: data.locale === 'en' ? 'en' : 'de',
        subject: data.subject || '',
        body: data.body || '',
        status: data.status || 'pending',
        errorMessage: data.errorMessage || null,
        metadataText: data.metadataText || null,
        scheduledFor: data.scheduledFor || null,
        sentAt: data.sentAt || null,
      },
      { transaction: options.transaction }
    );
  }

  async list(filter = {}, options = {}) {
    const where = {};
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.templateKey) {
      where.templateKey = filter.templateKey;
    }
    if (filter.email) {
      where.email = { [Op.like]: `%${String(filter.email).trim()}%` };
    }
    return this.models.Notification.findAll({
      where,
      include: [{ model: this.models.User, as: 'user' }],
      order: [['createdAt', 'DESC']],
      ...options,
    });
  }

  async getById(id, options = {}) {
    const notification = await this.models.Notification.findByPk(id, {
      include: [{ model: this.models.User, as: 'user' }],
      ...options,
    });
    if (!notification) {
      throw new Error('Notification not found');
    }
    return notification;
  }

  async listPending(limit = 100) {
    return this.models.Notification.findAll({
      where: {
        status: 'pending',
        [Op.or]: [
          { scheduledFor: null },
          { scheduledFor: { [Op.lte]: new Date() } },
        ],
      },
      order: [['createdAt', 'ASC']],
      limit,
    });
  }

  async markSent(id, options = {}) {
    const notification = await this.models.Notification.findByPk(id, {
      transaction: options.transaction,
    });
    if (!notification) {
      throw new Error('Notification not found');
    }
    await notification.update(
      {
        status: 'sent',
        sentAt: new Date(),
        errorMessage: null,
      },
      { transaction: options.transaction }
    );
    return notification;
  }

  async markFailed(id, errorMessage, options = {}) {
    const notification = await this.models.Notification.findByPk(id, {
      transaction: options.transaction,
    });
    if (!notification) {
      throw new Error('Notification not found');
    }
    await notification.update(
      {
        status: 'failed',
        errorMessage: String(errorMessage || 'Versand fehlgeschlagen').slice(0, 2000),
      },
      { transaction: options.transaction }
    );
    return notification;
  }
}

module.exports = NotificationService;
