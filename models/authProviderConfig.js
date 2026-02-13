module.exports = (sequelize, DataTypes) => {
  const AuthProviderConfig = sequelize.define(
    'AuthProviderConfig',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      provider: {
        type: DataTypes.ENUM('saml', 'ldap'),
        allowNull: false,
        unique: true,
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      displayName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        defaultValue: '',
      },
      config: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: 'auth_provider_configs',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ['provider'] },
      ],
    }
  );

  return AuthProviderConfig;
};
