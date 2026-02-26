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
        type: DataTypes.ENUM('smtp', 'sendmail'),
        allowNull: false,
        defaultValue: 'smtp',
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
      smtpHost: {
        type: DataTypes.STRING(191),
        allowNull: true,
        field: 'smtp_host',
      },
      smtpPort: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 587,
        field: 'smtp_port',
      },
      smtpSecure: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'smtp_secure',
      },
      smtpUser: {
        type: DataTypes.STRING(191),
        allowNull: true,
        field: 'smtp_user',
      },
      smtpPass: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'smtp_pass',
      },
      sendmailPath: {
        type: DataTypes.STRING(255),
        allowNull: true,
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
