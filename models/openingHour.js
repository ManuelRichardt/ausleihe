module.exports = (sequelize, DataTypes) => {
  const OpeningHour = sequelize.define(
    'OpeningHour',
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
      dayOfWeek: {
        type: DataTypes.ENUM('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'),
        allowNull: false,
      },
      openTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      closeTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      pickupOpenTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      pickupCloseTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      returnOpenTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      returnCloseTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      isClosed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      validFrom: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      validTo: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      isSpecial: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'opening_hours',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { fields: ['lending_location_id'] },
        { fields: ['day_of_week'] },
        { fields: ['is_special'] },
      ],
    }
  );

  OpeningHour.associate = (models) => {
    OpeningHour.belongsTo(models.LendingLocation, {
      foreignKey: 'lendingLocationId',
      as: 'lendingLocation',
    });
  };

  return OpeningHour;
};
