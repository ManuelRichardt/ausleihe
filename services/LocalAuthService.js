const { Op } = require('sequelize');
class LocalAuthService {
  constructor(models) {
    this.models = models;
  }

  async findLocalUser(username) {
    const raw = String(username || '').trim();
    const lowerValue = raw.toLowerCase();
    const { sequelize } = this.models;
    const where = {
      externalProvider: null,
      [Op.or]: [sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), lowerValue)],
    };
    return this.models.User.scope('withPassword').findOne({ where });
  }

  async authenticate(username, password) {
    if (!username || !password) {
      const err = new Error('Invalid credentials');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }
    const user = await this.findLocalUser(username);
    if (!user) {
      const err = new Error('Local account not found');
      err.code = 'LOCAL_USER_NOT_FOUND';
      throw err;
    }
    if (!user.isActive) {
      const err = new Error('Account inactive');
      err.code = 'ACCOUNT_INACTIVE';
      throw err;
    }
    if (!user.password) {
      const err = new Error('Local password not set');
      err.code = 'LOCAL_PASSWORD_MISSING';
      throw err;
    }
    const matches = await user.comparePassword(password);
    if (!matches) {
      const err = new Error('Invalid credentials');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }
    await user.update({ lastLoginAt: new Date() });
    return user;
  }
}

module.exports = LocalAuthService;
