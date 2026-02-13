module.exports = (sequelize, DataTypes) => {
  const OpeningException = sequelize.define(
    'OpeningException',
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
      date: {
        type: DataTypes.DATEONLY,
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
      reason: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
    },
    {
      tableName: 'opening_exceptions',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { fields: ['lending_location_id'] },
        { fields: ['date'] },
      ],
    }
  );

  OpeningException.associate = (models) => {
    OpeningException.belongsTo(models.LendingLocation, {
      foreignKey: 'lendingLocationId',
      as: 'lendingLocation',
    });
  };

  return OpeningException;
};
