const LEGACY_DEFAULT_TEMPLATES = Object.freeze([
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
]);

const DEFAULT_TEMPLATES = Object.freeze([
  {
    key: 'reservation_confirmation',
    subjectDe: 'Reservierungsbestätigung {{loanId}}',
    subjectEn: 'Reservation confirmation {{loanId}}',
    bodyDe:
      'Hallo {{firstName}} {{lastName}},\n\nIhre Reservierung {{loanId}} wurde erfasst.\nAusleihe: {{lendingLocation}}\nVon: {{reservedFrom}}\nBis: {{reservedUntil}}\nAssets:\n{{assets}}\n\nViele Grüße',
    bodyEn:
      'Hello {{firstName}} {{lastName}},\n\nyour reservation {{loanId}} has been created.\nLending location: {{lendingLocation}}\nFrom: {{reservedFrom}}\nUntil: {{reservedUntil}}\nAssets:\n{{assets}}\n\nBest regards',
  },
  {
    key: 'pickup_reminder',
    subjectDe: 'Abhol-Erinnerung {{loanId}}',
    subjectEn: 'Pickup reminder {{loanId}}',
    bodyDe:
      'Hallo {{firstName}} {{lastName}},\n\ndiese Nachricht erinnert an die Abholung für Reservierung {{loanId}}.\nAssets:\n{{assets}}',
    bodyEn:
      'Hello {{firstName}} {{lastName}},\n\nthis is a pickup reminder for reservation {{loanId}}.\nAssets:\n{{assets}}',
  },
  {
    key: 'return_reminder',
    subjectDe: 'Rückgabe-Erinnerung {{loanId}}',
    subjectEn: 'Return reminder {{loanId}}',
    bodyDe:
      'Hallo {{firstName}} {{lastName}},\n\ndiese Nachricht erinnert an die Rückgabe für Ausleihe {{loanId}} bis {{reservedUntil}}.\nAssets:\n{{assets}}',
    bodyEn:
      'Hello {{firstName}} {{lastName}},\n\nthis is a return reminder for loan {{loanId}} until {{reservedUntil}}.\nAssets:\n{{assets}}',
  },
  {
    key: 'overdue_notice',
    subjectDe: 'Überfällige Rückgabe {{loanId}}',
    subjectEn: 'Overdue return {{loanId}}',
    bodyDe:
      'Hallo {{firstName}} {{lastName}},\n\nAusleihe {{loanId}} ist überfällig. Bitte geben Sie die Gegenstände zurück.\nAssets:\n{{assets}}',
    bodyEn:
      'Hello {{firstName}} {{lastName}},\n\nloan {{loanId}} is overdue. Please return the items.\nAssets:\n{{assets}}',
  },
  {
    key: 'reservation_cancelled',
    subjectDe: 'Storno-Info {{loanId}}',
    subjectEn: 'Cancellation info {{loanId}}',
    bodyDe:
      'Hallo {{firstName}} {{lastName}},\n\nReservierung {{loanId}} wurde storniert.\nAssets:\n{{assets}}',
    bodyEn:
      'Hello {{firstName}} {{lastName}},\n\nreservation {{loanId}} has been cancelled.\nAssets:\n{{assets}}',
  },
]);

const LEGACY_TEMPLATE_BY_KEY = Object.freeze(
  LEGACY_DEFAULT_TEMPLATES.reduce((acc, template) => {
    acc[template.key] = template;
    return acc;
  }, {})
);

function shouldUseTemplateDefault(currentValue, defaultValue, legacyValue) {
  if (!currentValue) {
    return true;
  }
  if (legacyValue && currentValue === legacyValue) {
    return true;
  }
  return currentValue === defaultValue;
}

class MailTemplateService {
  constructor(models) {
    this.models = models;
  }

  async ensureDefaults() {
    for (const template of DEFAULT_TEMPLATES) {
      const legacyTemplate = LEGACY_TEMPLATE_BY_KEY[template.key] || {};
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
        subjectDe: shouldUseTemplateDefault(entry.subjectDe, template.subjectDe, legacyTemplate.subjectDe)
          ? template.subjectDe
          : entry.subjectDe,
        subjectEn: shouldUseTemplateDefault(entry.subjectEn, template.subjectEn, legacyTemplate.subjectEn)
          ? template.subjectEn
          : entry.subjectEn,
        bodyDe: shouldUseTemplateDefault(entry.bodyDe, template.bodyDe, legacyTemplate.bodyDe)
          ? template.bodyDe
          : entry.bodyDe,
        bodyEn: shouldUseTemplateDefault(entry.bodyEn, template.bodyEn, legacyTemplate.bodyEn)
          ? template.bodyEn
          : entry.bodyEn,
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

  normalizeVariables(variables = {}) {
    const source = variables && typeof variables === 'object' ? variables : {};
    const normalized = {};

    Object.entries(source).forEach(([key, value]) => {
      normalized[key] = value;
      const lowerKey = String(key).toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(normalized, lowerKey)) {
        normalized[lowerKey] = value;
      }
    });

    if (!Object.prototype.hasOwnProperty.call(normalized, 'firstName') && normalized.firstname !== undefined) {
      normalized.firstName = normalized.firstname;
    }
    if (!Object.prototype.hasOwnProperty.call(normalized, 'firstname') && normalized.firstName !== undefined) {
      normalized.firstname = normalized.firstName;
    }
    if (!Object.prototype.hasOwnProperty.call(normalized, 'lastName') && normalized.lastname !== undefined) {
      normalized.lastName = normalized.lastname;
    }
    if (!Object.prototype.hasOwnProperty.call(normalized, 'lastname') && normalized.lastName !== undefined) {
      normalized.lastname = normalized.lastName;
    }

    return normalized;
  }

  resolveVariableValue(variables = {}, key) {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return variables[key];
    }
    const lowerKey = String(key || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(variables, lowerKey)) {
      return variables[lowerKey];
    }
    return '';
  }

  render(template, locale = 'de', variables = {}) {
    const normalizedLocale = String(locale || '').toLowerCase() === 'en' ? 'en' : 'de';
    const subjectSource = normalizedLocale === 'en' ? template.subjectEn : template.subjectDe;
    const bodySource = normalizedLocale === 'en' ? template.bodyEn : template.bodyDe;
    const normalizedVariables = this.normalizeVariables(variables);
    const replacer = (_, key) => {
      const value = this.resolveVariableValue(normalizedVariables, key);
      return value === null || value === undefined ? '' : String(value);
    };
    return {
      subject: String(subjectSource || '').replace(/\{\{\s*([^}\s]+)\s*\}\}/g, replacer),
      body: String(bodySource || '').replace(/\{\{\s*([^}\s]+)\s*\}\}/g, replacer),
    };
  }

  getDefaults() {
    return DEFAULT_TEMPLATES.map((template) => ({ ...template }));
  }
}

module.exports = MailTemplateService;
module.exports.DEFAULT_TEMPLATES = DEFAULT_TEMPLATES;
