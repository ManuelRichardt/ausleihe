module.exports = (sequelize, DataTypes) => {
  const Jwt = sequelize.define(
    'Jwt',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      refreshToken: {
        type: DataTypes.STRING(512),
        allowNull: false,
      },
    },
    {
      tableName: 'jwt_tokens',
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['refresh_token'], unique: true },
      ],
    }
  );

  Jwt.associate = (models) => {
    Jwt.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Jwt;
};
