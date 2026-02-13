const { Client } = require('ldapts');
const { getLdapConfig } = require('../config/ldap');

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function resolveAttr(entry, attrName) {
  if (!attrName) {
    return null;
  }
  const value = entry[attrName];
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = normalizeValue(value);
  if (Buffer.isBuffer(normalized)) {
    return normalized.toString('hex');
  }
  return normalized;
}

function resolveAttrFromList(entry, attrList) {
  if (!attrList) {
    return null;
  }
  const parts = String(attrList)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
  for (const key of parts) {
    if (key.toLowerCase() === 'dn' && entry.dn) {
      return entry.dn;
    }
    const value = resolveAttr(entry, key);
    if (value) {
      return value;
    }
  }
  return null;
}

class LdapAuthService {
  constructor(models) {
    this.models = models;
  }

  async ensureEnabled() {
    const { provider } = await getLdapConfig();
    if (!provider || !provider.enabled) {
      const err = new Error('LDAP is disabled');
      err.status = 403;
      throw err;
    }
    return true;
  }

  buildUserDn(config, username) {
    if (!config.userDnTemplate) {
      return null;
    }
    const template = String(config.userDnTemplate);
    if (template.includes('{{username}}')) {
      return template.replace('{{username}}', username);
    }
    if (template.trim().endsWith('=') && config.baseDn) {
      return `${template}${username},${config.baseDn}`;
    }
    return template;
  }

  buildUserFilter(config, username) {
    if (!config.userFilter) {
      return `(uid=${username})`;
    }
    return String(config.userFilter).replace('{{username}}', username);
  }

  buildSearchOptions(config, username) {
    return {
      scope: config.searchScope || 'sub',
      filter: this.buildUserFilter(config, username),
      sizeLimit: 1,
    };
  }

  buildAttributeList(config) {
    const externalAttrs = config.attrExternalId
      ? String(config.attrExternalId)
          .split('|')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
    const attrs = new Set(
      [
        config.attrUsername,
        config.attrEmail,
        config.attrDisplayName,
        config.attrFirstName,
        config.attrLastName,
        config.attrGroups,
        ...externalAttrs,
      ].filter(Boolean)
    );
    return Array.from(attrs);
  }

  async authenticate({ username, password }) {
    await this.ensureEnabled();
    if (!username || !password) {
      const err = new Error('Invalid credentials');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }
    const { config, secrets } = await getLdapConfig();
    const cfg = config || {};
    if (!cfg.url || !cfg.baseDn) {
      throw new Error('LDAP configuration incomplete');
    }

    const client = new Client({
      url: cfg.url,
      timeout: cfg.timeoutMs || 8000,
      connectTimeout: cfg.connectTimeoutMs || 8000,
    });

    let entry;
    try {
      if (cfg.startTls) {
        await client.startTLS({
          rejectUnauthorized: secrets.tlsRejectUnauthorized,
        });
      }

      const bindDn = secrets.bindDn;
      const bindPassword = secrets.bindPassword;

      if (bindDn && bindPassword) {
        await client.bind(bindDn, bindPassword);
        const searchResult = await client.search(cfg.baseDn, {
          ...this.buildSearchOptions(cfg, username),
          attributes: this.buildAttributeList(cfg),
        });
        entry = (searchResult.searchEntries && searchResult.searchEntries[0]) || null;
      } else if (!cfg.userDnTemplate) {
        const searchResult = await client.search(cfg.baseDn, {
          ...this.buildSearchOptions(cfg, username),
          attributes: this.buildAttributeList(cfg),
        });
        entry = (searchResult.searchEntries && searchResult.searchEntries[0]) || null;
      }

      const userDn = entry ? entry.dn : this.buildUserDn(cfg, username);
      if (!userDn) {
        const err = new Error('Invalid credentials');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
      }

      await client.bind(userDn, password);

      if (!entry) {
        const searchResult = await client.search(userDn, {
          scope: 'base',
          attributes: this.buildAttributeList(cfg),
        });
        entry = (searchResult.searchEntries && searchResult.searchEntries[0]) || null;
      }

      if (!entry) {
        const err = new Error('Invalid credentials');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
      }

      const externalId = resolveAttrFromList(entry, cfg.attrExternalId) || entry.dn || null;
      const email = resolveAttr(entry, cfg.attrEmail) || null;
      const displayName = resolveAttr(entry, cfg.attrDisplayName) || null;
      const firstName = resolveAttr(entry, cfg.attrFirstName) || null;
      const lastName = resolveAttr(entry, cfg.attrLastName) || null;
      const usernameAttr = resolveAttr(entry, cfg.attrUsername) || username;
      const groupsRaw = resolveAttr(entry, cfg.attrGroups);
      const groups = Array.isArray(entry[cfg.attrGroups]) ? entry[cfg.attrGroups] : (groupsRaw ? [groupsRaw] : []);

      return {
        externalId,
        email,
        displayName,
        firstName,
        lastName,
        username: usernameAttr,
        groups,
      };
    } catch (err) {
      const safeError = new Error('Invalid credentials');
      safeError.code = err.code || 'INVALID_CREDENTIALS';
      throw safeError;
    } finally {
      try {
        await client.unbind();
      } catch (err) {
        // ignore
      }
    }
  }

  async testConnection({ username, password } = {}) {
    const { config, secrets } = await getLdapConfig();
    const cfg = config || {};
    if (!cfg.url || !cfg.baseDn) {
      throw new Error('LDAP configuration incomplete');
    }

    const client = new Client({
      url: cfg.url,
      timeout: cfg.timeoutMs || 8000,
      connectTimeout: cfg.connectTimeoutMs || 8000,
    });

    try {
      if (cfg.startTls) {
        await client.startTLS({
          rejectUnauthorized: secrets.tlsRejectUnauthorized,
        });
      }

      const bindDn = secrets.bindDn;
      const bindPassword = secrets.bindPassword;
      if (bindDn && bindPassword) {
        await client.bind(bindDn, bindPassword);
      }

      if (username && password) {
        let entry = null;
        if (!cfg.userDnTemplate) {
          const searchResult = await client.search(cfg.baseDn, {
            ...this.buildSearchOptions(cfg, username),
            attributes: ['dn'],
          });
          entry = (searchResult.searchEntries && searchResult.searchEntries[0]) || null;
        }
        const userDn = entry ? entry.dn : this.buildUserDn(cfg, username);
        if (!userDn) {
          throw new Error('LDAP user not found');
        }
        await client.bind(userDn, password);
      } else {
        await client.search(cfg.baseDn, {
          scope: cfg.searchScope || 'sub',
          filter: '(objectClass=*)',
          sizeLimit: 1,
        });
      }

      return true;
    } finally {
      try {
        await client.unbind();
      } catch (err) {
        // ignore
      }
    }
  }
}

module.exports = LdapAuthService;
