module.exports = (sequelize, DataTypes) => {
  const UiText = sequelize.define(
    'UiText',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: DataTypes.STRING(191),
        allowNull: false,
        unique: true,
      },
      de: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      en: {
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
      tableName: 'ui_texts',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ['key'] },
        { fields: ['is_active'] },
      ],
    }
  );

  return UiText;
};
