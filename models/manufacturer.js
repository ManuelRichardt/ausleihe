module.exports = (sequelize, DataTypes) => {
  const Manufacturer = sequelize.define(
    'Manufacturer',
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
      website: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'manufacturers',
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

  Manufacturer.associate = (models) => {
    Manufacturer.hasMany(models.AssetModel, { foreignKey: 'manufacturerId', as: 'models' });
    Manufacturer.belongsTo(models.LendingLocation, {
      foreignKey: 'lendingLocationId',
      as: 'lendingLocation',
    });
  };

  return Manufacturer;
};
