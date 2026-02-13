module.exports = (sequelize, DataTypes) => {
  const Asset = sequelize.define(
    'Asset',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      lendingLocationId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      assetModelId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      storageLocationId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      inventoryNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      serialNumber: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      condition: {
        type: DataTypes.ENUM('new', 'good', 'fair', 'damaged', 'lost'),
        allowNull: false,
        defaultValue: 'good',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'assets',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['lending_location_id', 'inventory_number'],
        },
        { fields: ['asset_model_id'] },
        { fields: ['storage_location_id'] },
      ],
    }
  );

  Asset.associate = (models) => {
    Asset.belongsTo(models.LendingLocation, {
      foreignKey: 'lendingLocationId',
      as: 'lendingLocation',
    });
    Asset.belongsTo(models.AssetModel, { foreignKey: 'assetModelId', as: 'model' });
    Asset.hasMany(models.LoanItem, { foreignKey: 'assetId', as: 'loanItems' });
    Asset.belongsTo(models.StorageLocation, { foreignKey: 'storageLocationId', as: 'storageLocation' });
    Asset.hasMany(models.AssetAttachment, { foreignKey: 'assetId', as: 'attachments' });
    Asset.hasMany(models.AssetMaintenance, { foreignKey: 'assetId', as: 'maintenances' });
    Asset.hasMany(models.CustomFieldValue, { foreignKey: 'assetInstanceId', as: 'customFieldValues' });
  };

  return Asset;
};
