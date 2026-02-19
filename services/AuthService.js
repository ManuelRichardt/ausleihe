const crypto = require('crypto');
const { signToken, verifyToken } = require('../middleware/web/token');

class AuthService {
  constructor(models) {
    this.models = models;
  }

  getAccessTokenTtlSeconds() {
    const value = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || '900', 10);
    return Number.isNaN(value) ? 900 : value;
  }

  getRefreshTokenTtlDays() {
    const value = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '14', 10);
    return Number.isNaN(value) ? 14 : value;
  }

  getRefreshTokenTtlMs() {
    return this.getRefreshTokenTtlDays() * 24 * 60 * 60 * 1000;
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateRefreshToken() {
    return crypto.randomBytes(48).toString('base64url');
  }

  buildCookieOptions(req, maxAgeMs) {
    const isSecure =
      (req && req.secure) ||
      (req && req.headers && req.headers['x-forwarded-proto'] === 'https') ||
      String(process.env.HTTPS_FORCE).toLowerCase() === 'true' ||
      String(process.env.HTTPS_REDIRECT).toLowerCase() === 'true';
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: Boolean(isSecure),
      maxAge: maxAgeMs,
      path: '/',
    };
  }

  createAccessToken(userId) {
    return signToken({ sub: userId }, process.env.ACCESS_TOKEN_SECRET, this.getAccessTokenTtlSeconds());
  }

  async persistRefreshToken(userId, refreshToken, transaction) {
    const refreshTokenHash = this.hashToken(refreshToken);
    return this.models.Jwt.create(
      {
        userId,
        refreshToken: refreshTokenHash,
      },
      { transaction }
    );
  }

  async revokeRefreshToken(refreshToken, transaction) {
    if (!refreshToken) {
      return false;
    }
    const refreshTokenHash = this.hashToken(refreshToken);
    const deleted = await this.models.Jwt.destroy({
      where: { refreshToken: refreshTokenHash },
      transaction,
    });
    return deleted > 0;
  }

  async getRefreshTokenRecord(refreshToken) {
    if (!refreshToken) {
      return null;
    }
    const refreshTokenHash = this.hashToken(refreshToken);
    return this.models.Jwt.findOne({ where: { refreshToken: refreshTokenHash } });
  }

  isRefreshTokenExpired(record) {
    if (!record || !record.createdAt) {
      return true;
    }
    const ttl = this.getRefreshTokenTtlMs();
    return Date.now() - new Date(record.createdAt).getTime() > ttl;
  }

  async login({ username, password, ipAddress, userAgent }) {
    const user = await this.models.User.scope('withPassword').findOne({ where: { username } });
    if (!user || !user.isActive) {
      await this.logAuthEvent(user ? user.id : null, 'login.failed', {
        username,
        ipAddress,
        userAgent,
      });
      throw new Error('Invalid credentials');
    }

    const matches = await user.comparePassword(password);
    if (!matches) {
      await this.logAuthEvent(user.id, 'login.failed', {
        username,
        ipAddress,
        userAgent,
      });
      throw new Error('Invalid credentials');
    }

    const accessToken = this.createAccessToken(user.id);
    const refreshToken = this.generateRefreshToken();

    await this.models.sequelize.transaction(async (transaction) => {
      await this.persistRefreshToken(user.id, refreshToken, transaction);
      await this.logAuthEvent(
        user.id,
        'login.success',
        { ipAddress, userAgent },
        transaction
      );
    });

    return { user, accessToken, refreshToken };
  }

  async refresh(refreshToken, meta = {}) {
    const record = await this.getRefreshTokenRecord(refreshToken);
    if (!record) {
      throw new Error('Invalid refresh token');
    }
    if (this.isRefreshTokenExpired(record)) {
      await this.revokeRefreshToken(refreshToken);
      throw new Error('Refresh token expired');
    }

    const userId = record.userId;
    const newAccessToken = this.createAccessToken(userId);
    const newRefreshToken = this.generateRefreshToken();

    await this.models.sequelize.transaction(async (transaction) => {
      await this.revokeRefreshToken(refreshToken, transaction);
      await this.persistRefreshToken(userId, newRefreshToken, transaction);
      await this.logAuthEvent(
        userId,
        'token.refresh',
        { ipAddress: meta.ipAddress, userAgent: meta.userAgent },
        transaction
      );
    });

    return { userId, accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken, meta = {}) {
    const record = await this.getRefreshTokenRecord(refreshToken);
    const userId = record ? record.userId : null;
    await this.revokeRefreshToken(refreshToken);
    await this.logAuthEvent(userId, 'logout', {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return true;
  }

  async cleanupExpiredRefreshTokens() {
    const cutoff = new Date(Date.now() - this.getRefreshTokenTtlMs());
    const deleted = await this.models.Jwt.destroy({
      where: {
        createdAt: { [this.models.Sequelize.Op.lt]: cutoff },
      },
    });
    return deleted;
  }

  verifyAccessToken(token) {
    return verifyToken(token, process.env.ACCESS_TOKEN_SECRET);
  }

  async logAuthEvent(userId, action, metadata, transaction) {
    if (!userId) {
      return null;
    }
    return this.models.AuditLog.create(
      {
        userId,
        action,
        entity: 'User',
        entityId: userId,
        metadata: metadata || null,
      },
      transaction ? { transaction } : undefined
    );
  }
}

module.exports = AuthService;
