module.exports = (sequelize, DataTypes) => {
  const BundleItem = sequelize.define(
    'BundleItem',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      bundleDefinitionId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      componentAssetModelId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      isOptional: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'bundle_items',
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [
        { fields: ['bundle_definition_id'] },
        { fields: ['component_asset_model_id'] },
      ],
    }
  );

  BundleItem.associate = (models) => {
    BundleItem.belongsTo(models.BundleDefinition, {
      foreignKey: 'bundleDefinitionId',
      as: 'bundleDefinition',
    });
    BundleItem.belongsTo(models.AssetModel, {
      foreignKey: 'componentAssetModelId',
      as: 'componentModel',
    });
  };

  return BundleItem;
};
