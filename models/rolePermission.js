module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define(
    'RolePermission',
    {
      roleId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      permissionId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
    },
    {
      tableName: 'role_permissions',
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['role_id', 'permission_id'],
        },
      ],
    }
  );

  RolePermission.associate = (models) => {
    RolePermission.belongsTo(models.Role, { foreignKey: 'roleId', as: 'role' });
    RolePermission.belongsTo(models.Permission, { foreignKey: 'permissionId', as: 'permission' });
  };

  return RolePermission;
};
