module.exports = (sequelize, DataTypes) => {
  const AssetModel = sequelize.define(
    'AssetModel',
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
      manufacturerId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      technicalDescription: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      specs: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
      imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'asset_models',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['lending_location_id', 'manufacturer_id', 'name'],
        },
        { fields: ['category_id'] },
        { fields: ['lending_location_id'] },
      ],
    }
  );

  AssetModel.associate = (models) => {
    AssetModel.belongsTo(models.LendingLocation, {
      foreignKey: 'lendingLocationId',
      as: 'lendingLocation',
    });
    AssetModel.belongsTo(models.Manufacturer, {
      foreignKey: 'manufacturerId',
      as: 'manufacturer',
    });
    AssetModel.belongsTo(models.AssetCategory, {
      foreignKey: 'categoryId',
      as: 'category',
    });
    AssetModel.hasMany(models.Asset, { foreignKey: 'assetModelId', as: 'assets' });
    AssetModel.hasMany(models.AssetAttachment, { foreignKey: 'assetModelId', as: 'attachments' });
    AssetModel.hasMany(models.CustomFieldDefinition, { foreignKey: 'assetModelId', as: 'customFieldDefinitions' });
  };

  return AssetModel;
};
