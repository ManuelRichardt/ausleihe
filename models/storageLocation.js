module.exports = (sequelize, DataTypes) => {
  const StorageLocation = sequelize.define(
    'StorageLocation',
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
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'storage_locations',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { fields: ['lending_location_id'] },
        {
          unique: true,
          fields: ['lending_location_id', 'name'],
        },
      ],
    }
  );

  StorageLocation.associate = (models) => {
    StorageLocation.belongsTo(models.LendingLocation, {
      foreignKey: 'lendingLocationId',
      as: 'lendingLocation',
    });
    StorageLocation.hasMany(models.Asset, { foreignKey: 'storageLocationId', as: 'assets' });
  };

  return StorageLocation;
};
