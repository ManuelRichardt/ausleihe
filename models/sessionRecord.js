module.exports = (sequelize, DataTypes) => {
  const SessionRecord = sequelize.define(
    'SessionRecord',
    {
      sid: {
        type: DataTypes.STRING(128),
        allowNull: false,
        primaryKey: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at',
      },
      data: {
        type: DataTypes.TEXT('long'),
        allowNull: false,
      },
    },
    {
      tableName: 'sessions',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [{ fields: ['expires_at'] }],
    }
  );

  return SessionRecord;
};
