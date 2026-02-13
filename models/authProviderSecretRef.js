module.exports = (sequelize, DataTypes) => {
  const AuthProviderSecretRef = sequelize.define(
    'AuthProviderSecretRef',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      provider: {
        type: DataTypes.ENUM('saml', 'ldap'),
        allowNull: false,
      },
      secretKey: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: 'auth_provider_secret_refs',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ['provider', 'secret_key'] },
      ],
    }
  );

  return AuthProviderSecretRef;
};
