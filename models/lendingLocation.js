module.exports = (sequelize, DataTypes) => {
  const LendingLocation = sequelize.define(
    'LendingLocation',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      contactEmail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
          isEmail: true,
        },
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'lending_locations',
      timestamps: true,
      paranoid: true,
      underscored: true,
    }
  );

  LendingLocation.associate = (models) => {
    LendingLocation.hasMany(models.Asset, { foreignKey: 'lendingLocationId', as: 'assets' });
    LendingLocation.hasMany(models.OpeningHour, { foreignKey: 'lendingLocationId', as: 'openingHours' });
    LendingLocation.hasMany(models.OpeningException, { foreignKey: 'lendingLocationId', as: 'openingExceptions' });
    LendingLocation.hasMany(models.Loan, { foreignKey: 'lendingLocationId', as: 'loans' });
    LendingLocation.hasMany(models.UserRole, { foreignKey: 'lendingLocationId', as: 'userRoles' });
    LendingLocation.hasMany(models.StorageLocation, { foreignKey: 'lendingLocationId', as: 'storageLocations' });
    LendingLocation.hasMany(models.CustomFieldDefinition, { foreignKey: 'lendingLocationId', as: 'customFieldDefinitions' });
  };

  return LendingLocation;
};
