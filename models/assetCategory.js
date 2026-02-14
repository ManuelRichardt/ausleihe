module.exports = (sequelize, DataTypes) => {
  const AssetCategory = sequelize.define(
    'AssetCategory',
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
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      tableName: 'asset_categories',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['lending_location_id', 'name'],
        },
        { fields: ['lending_location_id'] },
      ],
    }
  );

  AssetCategory.associate = (models) => {
    AssetCategory.hasMany(models.AssetModel, { foreignKey: 'categoryId', as: 'assetModels' });
    AssetCategory.belongsTo(models.LendingLocation, {
      foreignKey: 'lendingLocationId',
      as: 'lendingLocation',
    });
  };

  return AssetCategory;
};
