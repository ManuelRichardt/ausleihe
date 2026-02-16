const { Op } = require('sequelize');
const path = require('path');
const { extractUiTextEntriesFromViews } = require('../utils/uiTextExtractor');

const CACHE_TTL_MS = 30000;
const AUTO_SYNC_TTL_MS = 5 * 60 * 1000;

class UiTextService {
  constructor(models) {
    this.models = models;
    this.cache = new Map();
    this.phraseCache = new Map();
    this.lastAutoSyncAt = 0;
    this.autoSyncPromise = null;
  }

  cacheKey(locale) {
    return `locale:${locale}`;
  }

  invalidate(locale) {
    if (locale) {
      this.cache.delete(this.cacheKey(locale));
      this.phraseCache.delete(this.cacheKey(locale));
      return;
    }
    this.cache.clear();
    this.phraseCache.clear();
  }

  getCached(locale) {
    const entry = this.cache.get(this.cacheKey(locale));
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(this.cacheKey(locale));
      return null;
    }
    return entry.value;
  }

  setCached(locale, value) {
    this.cache.set(this.cacheKey(locale), {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  getPhraseCached(locale) {
    const entry = this.phraseCache.get(this.cacheKey(locale));
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.phraseCache.delete(this.cacheKey(locale));
      return null;
    }
    return entry.value;
  }

  setPhraseCached(locale, value) {
    this.phraseCache.set(this.cacheKey(locale), {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  async list(filter = {}, options = {}) {
    const where = {};
    if (filter.query) {
      const q = `%${String(filter.query).trim()}%`;
      where[Op.or] = [
        { key: { [Op.like]: q } },
        { de: { [Op.like]: q } },
        { en: { [Op.like]: q } },
      ];
    }
    if (filter.activeOnly) {
      where.isActive = true;
    }
    return this.models.UiText.findAll({
      where,
      order: [['key', 'ASC']],
      ...options,
    });
  }

  async count(filter = {}) {
    const where = {};
    if (filter.query) {
      const q = `%${String(filter.query).trim()}%`;
      where[Op.or] = [
        { key: { [Op.like]: q } },
        { de: { [Op.like]: q } },
        { en: { [Op.like]: q } },
      ];
    }
    if (filter.activeOnly) {
      where.isActive = true;
    }
    return this.models.UiText.count({ where });
  }

  async getById(id, options = {}) {
    const entry = await this.models.UiText.findByPk(id, options);
    if (!entry) {
      throw new Error('UiText not found');
    }
    return entry;
  }

  async getMap(locale = 'de') {
    const normalizedLocale = String(locale || 'de').toLowerCase() === 'en' ? 'en' : 'de';
    const cached = this.getCached(normalizedLocale);
    if (cached) {
      return cached;
    }
    const entries = await this.models.UiText.findAll({
      where: { isActive: true },
      order: [['key', 'ASC']],
    });
    const map = {};
    entries.forEach((entry) => {
      const localized = normalizedLocale === 'en' ? entry.en : entry.de;
      const fallback = normalizedLocale === 'en' ? entry.de : entry.en;
      map[entry.key] = (localized || fallback || '').trim();
    });
    this.setCached(normalizedLocale, map);
    return map;
  }

  async getPhraseMap(locale = 'de') {
    const normalizedLocale = String(locale || 'de').toLowerCase() === 'en' ? 'en' : 'de';
    const cached = this.getPhraseCached(normalizedLocale);
    if (cached) {
      return cached;
    }

    if (normalizedLocale !== 'en') {
      this.setPhraseCached(normalizedLocale, []);
      return [];
    }

    const entries = await this.models.UiText.findAll({
      where: { isActive: true },
      attributes: ['de', 'en'],
      order: [['key', 'ASC']],
    });

    const pairs = entries
      .map((entry) => {
        const source = String(entry.de || '').trim();
        const target = String(entry.en || entry.de || '').trim();
        if (!source || !target || source === target) {
          return null;
        }
        return [source, target];
      })
      .filter(Boolean)
      .sort((a, b) => b[0].length - a[0].length);

    this.setPhraseCached(normalizedLocale, pairs);
    return pairs;
  }

  async syncAutoKeysFromViews(options = {}) {
    const viewsRoot = options.viewsRoot || path.join(process.cwd(), 'views');
    const includeInactive = options.includeInactive === true;
    const entries = extractUiTextEntriesFromViews(viewsRoot);
    if (!entries.length) {
      return { scanned: 0, created: 0, updated: 0 };
    }

    const keys = entries.map((entry) => entry.key);
    const existing = await this.models.UiText.findAll({
      where: { key: { [Op.in]: keys } },
      paranoid: false,
    });
    const existingMap = new Map(existing.map((entry) => [entry.key, entry]));

    const toCreate = [];
    const toUpdate = [];

    entries.forEach((entry) => {
      const current = existingMap.get(entry.key);
      if (!current) {
        toCreate.push({
          key: entry.key,
          de: entry.de,
          en: entry.en,
          isActive: includeInactive ? false : true,
        });
        return;
      }

      const patch = {};
      if (!current.de) {
        patch.de = entry.de;
      }
      if (!current.en) {
        patch.en = entry.en || entry.de;
      }
      if (current.deletedAt) {
        patch.deletedAt = null;
      }
      if (!current.isActive && !includeInactive) {
        patch.isActive = true;
      }
      if (Object.keys(patch).length) {
        toUpdate.push({ model: current, patch });
      }
    });

    if (toCreate.length) {
      await this.models.UiText.bulkCreate(toCreate);
    }

    for (const update of toUpdate) {
      await update.model.update(update.patch);
    }

    this.invalidate();
    return {
      scanned: entries.length,
      created: toCreate.length,
      updated: toUpdate.length,
    };
  }

  async syncAutoKeysFromViewsIfNeeded(options = {}) {
    const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : AUTO_SYNC_TTL_MS;
    const now = Date.now();
    if (now - this.lastAutoSyncAt < ttlMs) {
      return null;
    }
    if (this.autoSyncPromise) {
      return this.autoSyncPromise;
    }

    this.autoSyncPromise = this.syncAutoKeysFromViews(options)
      .then((result) => {
        this.lastAutoSyncAt = Date.now();
        return result;
      })
      .catch(() => {
        this.lastAutoSyncAt = Date.now();
        return null;
      })
      .finally(() => {
        this.autoSyncPromise = null;
      });

    return this.autoSyncPromise;
  }

  async create(data) {
    const key = String(data.key || '').trim();
    if (!key) {
      const err = new Error('Key ist erforderlich');
      err.status = 422;
      throw err;
    }
    const created = await this.models.UiText.create({
      key,
      de: data.de || '',
      en: data.en || '',
      isActive: data.isActive !== false,
    });
    this.invalidate();
    return created;
  }

  async update(id, data) {
    const entry = await this.getById(id);
    const key = String(data.key || entry.key || '').trim();
    if (!key) {
      const err = new Error('Key ist erforderlich');
      err.status = 422;
      throw err;
    }
    await entry.update({
      key,
      de: data.de !== undefined ? data.de : entry.de,
      en: data.en !== undefined ? data.en : entry.en,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : entry.isActive,
    });
    this.invalidate();
    return entry;
  }

  async upsertByKey(key, values = {}) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) {
      return null;
    }
    const [entry] = await this.models.UiText.findOrCreate({
      where: { key: normalizedKey },
      defaults: {
        key: normalizedKey,
        de: values.de || '',
        en: values.en || '',
        isActive: true,
      },
    });
    if (values && (values.de !== undefined || values.en !== undefined || values.isActive !== undefined)) {
      await entry.update({
        de: values.de !== undefined ? values.de : entry.de,
        en: values.en !== undefined ? values.en : entry.en,
        isActive: values.isActive !== undefined ? Boolean(values.isActive) : entry.isActive,
      });
    }
    this.invalidate();
    return entry;
  }
}

module.exports = UiTextService;
