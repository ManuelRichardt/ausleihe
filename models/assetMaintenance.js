module.exports = (sequelize, DataTypes) => {
  const AssetMaintenance = sequelize.define(
    'AssetMaintenance',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      assetId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('reported', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'reported',
      },
      reportedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'asset_maintenances',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { fields: ['asset_id'] },
        { fields: ['status'] },
      ],
    }
  );

  AssetMaintenance.associate = (models) => {
    AssetMaintenance.belongsTo(models.Asset, { foreignKey: 'assetId', as: 'asset' });
  };

  return AssetMaintenance;
};
