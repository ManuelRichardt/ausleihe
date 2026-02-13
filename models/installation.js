module.exports = (sequelize, DataTypes) => {
  const Installation = sequelize.define(
    'Installation',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      installedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      installedByUserId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'installations',
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [
        { unique: true, fields: ['key'] },
        { fields: ['installed_by_user_id'] },
      ],
    }
  );

  Installation.associate = (models) => {
    Installation.belongsTo(models.User, { foreignKey: 'installedByUserId', as: 'installedBy' });
  };

  return Installation;
};
