const CACHE_TTL_MS = 30000;

const cache = new Map();

function cacheKey(provider) {
  return `auth:${provider}`;
}

function getCached(provider) {
  const entry = cache.get(cacheKey(provider));
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    cache.delete(cacheKey(provider));
    return null;
  }
  return entry.value;
}

function setCached(provider, value) {
  cache.set(cacheKey(provider), {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

class ConfigService {
  constructor(models) {
    this.models = models;
  }

  invalidate(provider) {
    if (provider) {
      cache.delete(cacheKey(provider));
    }
  }

  async getAuthProvider(provider) {
    const cached = getCached(provider);
    if (cached) {
      return cached;
    }
    const record = await this.models.AuthProviderConfig.findOne({ where: { provider } });
    const value = record
      ? {
          enabled: Boolean(record.enabled),
          displayName: record.displayName || provider,
          config: record.config || {},
        }
      : {
          enabled: false,
          displayName: provider,
          config: {},
        };
    setCached(provider, value);
    return value;
  }

  async setAuthProvider(provider, patch) {
    const [record] = await this.models.AuthProviderConfig.findOrCreate({
      where: { provider },
      defaults: {
        provider,
        enabled: false,
        displayName: provider,
        config: {},
      },
    });

    const updates = {};
    if (patch.enabled !== undefined) {
      updates.enabled = Boolean(patch.enabled);
    }
    if (patch.displayName !== undefined) {
      updates.displayName = patch.displayName || provider;
    }
    if (patch.config !== undefined) {
      updates.config = patch.config || {};
    }

    await record.update(updates);
    this.invalidate(provider);
    return {
      enabled: Boolean(record.enabled),
      displayName: record.displayName || provider,
      config: record.config || {},
    };
  }

  async isEnabled(provider) {
    const cfg = await this.getAuthProvider(provider);
    return Boolean(cfg && cfg.enabled);
  }
}

module.exports = ConfigService;
