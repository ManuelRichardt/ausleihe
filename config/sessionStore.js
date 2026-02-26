const session = require('express-session');
const { Op } = require('sequelize');

function parseCleanupIntervalMs() {
  const rawMinutes = parseInt(process.env.SESSION_STORE_CLEANUP_INTERVAL_MINUTES || '15', 10);
  const minutes = Number.isNaN(rawMinutes) ? 15 : Math.max(rawMinutes, 1);
  return minutes * 60 * 1000;
}

class SequelizeSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    if (!options.sessionModel) {
      throw new Error('sessionModel is required');
    }
    this.sessionModel = options.sessionModel;
    this.defaultTtlMs = options.defaultTtlMs || 1000 * 60 * 60 * 8;
    this.cleanupIntervalMs = options.cleanupIntervalMs || parseCleanupIntervalMs();
    this._readyPromise = null;
    this._cleanupTimer = null;
  }

  ensureReady() {
    if (!this._readyPromise) {
      // Keep session storage schema isolated from full DB_SYNC.
      this._readyPromise = this.sessionModel.sync();
    }
    return this._readyPromise;
  }

  getExpiryDate(sessionData) {
    const cookie = sessionData && sessionData.cookie ? sessionData.cookie : {};
    if (cookie.expires) {
      const expires = new Date(cookie.expires);
      if (!Number.isNaN(expires.getTime())) {
        return expires;
      }
    }
    const maxAgeMs = Number(cookie.maxAge);
    if (Number.isFinite(maxAgeMs) && maxAgeMs > 0) {
      return new Date(Date.now() + maxAgeMs);
    }
    return new Date(Date.now() + this.defaultTtlMs);
  }

  withCallback(operation, callback, expectsResult = false) {
    Promise.resolve()
      .then(() => this.ensureReady())
      .then(operation)
      .then((result) => {
        if (typeof callback === 'function') {
          callback(null, expectsResult ? result : undefined);
        }
      })
      .catch((err) => {
        if (typeof callback === 'function') {
          callback(err);
        }
      });
  }

  get(sid, callback) {
    this.withCallback(async () => {
      const row = await this.sessionModel.findByPk(sid);
      if (!row) {
        return null;
      }
      if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) {
        await this.sessionModel.destroy({ where: { sid } });
        return null;
      }
      return JSON.parse(row.data);
    }, callback, true);
  }

  set(sid, sessionData, callback) {
    this.withCallback(async () => {
      const expiresAt = this.getExpiryDate(sessionData);
      await this.sessionModel.upsert({
        sid,
        data: JSON.stringify(sessionData),
        expiresAt,
      });
    }, callback);
  }

  destroy(sid, callback) {
    this.withCallback(async () => {
      await this.sessionModel.destroy({ where: { sid } });
    }, callback);
  }

  touch(sid, sessionData, callback) {
    this.withCallback(async () => {
      const expiresAt = this.getExpiryDate(sessionData);
      await this.sessionModel.update(
        {
          expiresAt,
          data: JSON.stringify(sessionData),
        },
        { where: { sid } }
      );
    }, callback);
  }

  length(callback) {
    this.withCallback(async () => this.sessionModel.count({
      where: {
        expiresAt: { [Op.gt]: new Date() },
      },
    }), callback, true);
  }

  clear(callback) {
    this.withCallback(async () => {
      await this.sessionModel.destroy({ where: {} });
    }, callback);
  }

  async pruneExpired() {
    await this.ensureReady();
    await this.sessionModel.destroy({
      where: {
        expiresAt: { [Op.lte]: new Date() },
      },
    });
  }

  startCleanup() {
    if (this._cleanupTimer || this.cleanupIntervalMs <= 0) {
      return;
    }
    this._cleanupTimer = setInterval(() => {
      this.pruneExpired().catch(() => {});
    }, this.cleanupIntervalMs);
    if (typeof this._cleanupTimer.unref === 'function') {
      this._cleanupTimer.unref();
    }
  }

  stopCleanup() {
    if (!this._cleanupTimer) {
      return;
    }
    clearInterval(this._cleanupTimer);
    this._cleanupTimer = null;
  }
}

function createSessionStore(options = {}) {
  const store = new SequelizeSessionStore(options);
  store.startCleanup();
  return store;
}

module.exports = {
  SequelizeSessionStore,
  createSessionStore,
};
