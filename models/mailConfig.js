module.exports = (sequelize, DataTypes) => {
  const MailConfig = sequelize.define(
    'MailConfig',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      isEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      transport: {
        type: DataTypes.ENUM('sendmail'),
        allowNull: false,
        defaultValue: 'sendmail',
      },
      fromEmail: {
        type: DataTypes.STRING(191),
        allowNull: true,
      },
      fromName: {
        type: DataTypes.STRING(191),
        allowNull: true,
      },
      replyTo: {
        type: DataTypes.STRING(191),
        allowNull: true,
      },
      sendmailPath: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: '/usr/sbin/sendmail',
      },
    },
    {
      tableName: 'mail_configs',
      timestamps: true,
      paranoid: true,
      underscored: true,
    }
  );

  return MailConfig;
};
