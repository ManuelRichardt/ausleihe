module.exports = (sequelize, DataTypes) => {
  const InventoryStock = sequelize.define(
    'InventoryStock',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      assetModelId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      lendingLocationId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      quantityTotal: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      quantityAvailable: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      minThreshold: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      reorderThreshold: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: 'inventory_stocks',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ['asset_model_id', 'lending_location_id'] },
        { fields: ['asset_model_id'] },
        { fields: ['lending_location_id'] },
      ],
    }
  );

  InventoryStock.associate = (models) => {
    InventoryStock.belongsTo(models.AssetModel, { foreignKey: 'assetModelId', as: 'assetModel' });
    InventoryStock.belongsTo(models.LendingLocation, { foreignKey: 'lendingLocationId', as: 'lendingLocation' });
  };

  return InventoryStock;
};
