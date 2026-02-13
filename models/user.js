const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      firstName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      lastName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      externalProvider: {
        type: DataTypes.ENUM('saml', 'ldap'),
        allowNull: true,
      },
      externalId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'users',
      timestamps: true,
      paranoid: true,
      underscored: true,
      defaultScope: {
        attributes: { exclude: ['password'] },
      },
      scopes: {
        withPassword: {
          attributes: { exclude: [] },
        },
      },
      indexes: [
        { fields: ['external_provider', 'external_id'] },
        { fields: ['email'] },
        { fields: ['username'] },
      ],
      hooks: {
        beforeCreate: async (user) => {
          if (user.password) {
            user.password = await bcrypt.hash(user.password, 12);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed('password') && user.password) {
            user.password = await bcrypt.hash(user.password, 12);
          }
        },
      },
    }
  );

  User.associate = (models) => {
    User.hasMany(models.UserRole, { foreignKey: 'userId', as: 'userRoles' });
    User.belongsToMany(models.Role, {
      through: { model: models.UserRole, unique: false },
      foreignKey: 'userId',
      otherKey: 'roleId',
      as: 'roles',
    });
    User.hasMany(models.Loan, { foreignKey: 'userId', as: 'loans' });
    User.hasMany(models.LoanSignature, { foreignKey: 'userId', as: 'loanSignatures' });
    User.hasMany(models.Jwt, { foreignKey: 'userId', as: 'jwtTokens' });
    User.hasMany(models.AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
    User.hasMany(models.LoanEvent, { foreignKey: 'userId', as: 'loanEvents' });
    User.hasMany(models.Installation, { foreignKey: 'installedByUserId', as: 'installations' });
  };

  User.prototype.comparePassword = async function comparePassword(plainPassword) {
    if (!this.password) {
      return false;
    }
    return bcrypt.compare(plainPassword, this.password);
  };

  User.prototype.setPassword = async function setPassword(plainPassword) {
    if (!plainPassword) {
      this.password = null;
      return;
    }
    this.password = await bcrypt.hash(plainPassword, 12);
  };

  return User;
};
