module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define(
    'Role',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      scope: {
        type: DataTypes.ENUM('global', 'ausleihe', 'both'),
        allowNull: false,
        defaultValue: 'global',
      },
    },
    {
      tableName: 'roles',
      timestamps: true,
      paranoid: true,
      underscored: true,
    }
  );

  Role.associate = (models) => {
    Role.belongsToMany(models.User, {
      through: { model: models.UserRole, unique: false },
      foreignKey: 'roleId',
      otherKey: 'userId',
      as: 'users',
    });
    Role.belongsToMany(models.Permission, {
      through: models.RolePermission,
      foreignKey: 'roleId',
      otherKey: 'permissionId',
      as: 'permissions',
    });
  };

  return Role;
};
