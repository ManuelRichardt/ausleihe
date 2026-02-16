const DEFAULT_TEMPLATES = [
  {
    key: 'reservation_confirmation',
    subjectDe: 'Reservierungsbestätigung {{loanId}}',
    subjectEn: 'Reservation confirmation {{loanId}}',
    bodyDe: 'Hallo {{firstName}},\n\nIhre Reservierung {{loanId}} wurde erfasst.\nAusleihe: {{lendingLocation}}\nVon: {{reservedFrom}}\nBis: {{reservedUntil}}\n\nViele Grüße',
    bodyEn: 'Hello {{firstName}},\n\nyour reservation {{loanId}} has been created.\nLending location: {{lendingLocation}}\nFrom: {{reservedFrom}}\nUntil: {{reservedUntil}}\n\nBest regards',
  },
  {
    key: 'pickup_reminder',
    subjectDe: 'Abhol-Erinnerung {{loanId}}',
    subjectEn: 'Pickup reminder {{loanId}}',
    bodyDe: 'Hallo {{firstName}},\n\ndiese Nachricht erinnert an die Abholung für Reservierung {{loanId}}.',
    bodyEn: 'Hello {{firstName}},\n\nthis is a pickup reminder for reservation {{loanId}}.',
  },
  {
    key: 'return_reminder',
    subjectDe: 'Rückgabe-Erinnerung {{loanId}}',
    subjectEn: 'Return reminder {{loanId}}',
    bodyDe: 'Hallo {{firstName}},\n\ndiese Nachricht erinnert an die Rückgabe für Ausleihe {{loanId}} bis {{reservedUntil}}.',
    bodyEn: 'Hello {{firstName}},\n\nthis is a return reminder for loan {{loanId}} until {{reservedUntil}}.',
  },
  {
    key: 'overdue_notice',
    subjectDe: 'Überfällige Rückgabe {{loanId}}',
    subjectEn: 'Overdue return {{loanId}}',
    bodyDe: 'Hallo {{firstName}},\n\nAusleihe {{loanId}} ist überfällig. Bitte geben Sie die Gegenstände zurück.',
    bodyEn: 'Hello {{firstName}},\n\nloan {{loanId}} is overdue. Please return the items.',
  },
  {
    key: 'reservation_cancelled',
    subjectDe: 'Storno-Info {{loanId}}',
    subjectEn: 'Cancellation info {{loanId}}',
    bodyDe: 'Hallo {{firstName}},\n\nReservierung {{loanId}} wurde storniert.',
    bodyEn: 'Hello {{firstName}},\n\nreservation {{loanId}} has been cancelled.',
  },
];

class MailTemplateService {
  constructor(models) {
    this.models = models;
  }

  async ensureDefaults() {
    for (const template of DEFAULT_TEMPLATES) {
      const [entry] = await this.models.MailTemplate.findOrCreate({
        where: { key: template.key },
        defaults: {
          key: template.key,
          subjectDe: template.subjectDe,
          subjectEn: template.subjectEn,
          bodyDe: template.bodyDe,
          bodyEn: template.bodyEn,
          isActive: true,
        },
      });
      await entry.update({
        subjectDe: entry.subjectDe || template.subjectDe,
        subjectEn: entry.subjectEn || template.subjectEn,
        bodyDe: entry.bodyDe || template.bodyDe,
        bodyEn: entry.bodyEn || template.bodyEn,
      });
    }
  }

  async list(options = {}) {
    return this.models.MailTemplate.findAll({
      order: [['key', 'ASC']],
      ...options,
    });
  }

  async getById(id, options = {}) {
    const template = await this.models.MailTemplate.findByPk(id, options);
    if (!template) {
      throw new Error('MailTemplate not found');
    }
    return template;
  }

  async getByKey(key, options = {}) {
    const template = await this.models.MailTemplate.findOne({
      where: { key },
      ...options,
    });
    if (!template) {
      throw new Error('MailTemplate not found');
    }
    return template;
  }

  async update(id, data = {}) {
    const template = await this.getById(id);
    await template.update({
      key: data.key !== undefined ? String(data.key || '').trim() : template.key,
      subjectDe: data.subjectDe !== undefined ? String(data.subjectDe || '').trim() : template.subjectDe,
      subjectEn: data.subjectEn !== undefined ? String(data.subjectEn || '').trim() : template.subjectEn,
      bodyDe: data.bodyDe !== undefined ? String(data.bodyDe || '') : template.bodyDe,
      bodyEn: data.bodyEn !== undefined ? String(data.bodyEn || '') : template.bodyEn,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : template.isActive,
    });
    return template;
  }

  render(template, locale = 'de', variables = {}) {
    const normalizedLocale = String(locale || '').toLowerCase() === 'en' ? 'en' : 'de';
    const subjectSource = normalizedLocale === 'en' ? template.subjectEn : template.subjectDe;
    const bodySource = normalizedLocale === 'en' ? template.bodyEn : template.bodyDe;
    const replacer = (_, key) => {
      const value = Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : '';
      return value === null || value === undefined ? '' : String(value);
    };
    return {
      subject: String(subjectSource || '').replace(/\{\{\s*([^}\s]+)\s*\}\}/g, replacer),
      body: String(bodySource || '').replace(/\{\{\s*([^}\s]+)\s*\}\}/g, replacer),
    };
  }

  getDefaults() {
    return DEFAULT_TEMPLATES.slice();
  }
}

module.exports = MailTemplateService;
