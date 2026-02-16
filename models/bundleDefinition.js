module.exports = (sequelize, DataTypes) => {
  const BundleDefinition = sequelize.define(
    'BundleDefinition',
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
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'bundle_definitions',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { fields: ['asset_model_id'] },
        { fields: ['lending_location_id'] },
      ],
    }
  );

  BundleDefinition.associate = (models) => {
    BundleDefinition.belongsTo(models.AssetModel, {
      foreignKey: 'assetModelId',
      as: 'bundleModel',
    });
    BundleDefinition.belongsTo(models.LendingLocation, {
      foreignKey: 'lendingLocationId',
      as: 'lendingLocation',
    });
    BundleDefinition.hasMany(models.BundleItem, {
      foreignKey: 'bundleDefinitionId',
      as: 'items',
    });
  };

  return BundleDefinition;
};
