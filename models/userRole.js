module.exports = (sequelize, DataTypes) => {
  const UserRole = sequelize.define(
    'UserRole',
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
      roleId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      lendingLocationId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: 'user_roles',
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'role_id', 'lending_location_id'],
        },
      ],
    }
  );

  UserRole.associate = (models) => {
    UserRole.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    UserRole.belongsTo(models.Role, { foreignKey: 'roleId', as: 'role' });
    UserRole.belongsTo(models.LendingLocation, {
      foreignKey: 'lendingLocationId',
      as: 'lendingLocation',
    });
  };

  return UserRole;
};
