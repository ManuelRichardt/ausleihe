module.exports = (sequelize, DataTypes) => {
  const MailTemplate = sequelize.define(
    'MailTemplate',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      subjectDe: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      subjectEn: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      bodyDe: {
        type: DataTypes.TEXT('long'),
        allowNull: false,
      },
      bodyEn: {
        type: DataTypes.TEXT('long'),
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'mail_templates',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ['key'] },
        { fields: ['is_active'] },
      ],
    }
  );

  return MailTemplate;
};
