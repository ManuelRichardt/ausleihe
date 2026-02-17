module.exports = (sequelize, DataTypes) => {
  const PrivacyConfig = sequelize.define(
    'PrivacyConfig',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      isEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      returnedLoanRetentionMonths: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
        validate: {
          min: 1,
          max: 120,
        },
      },
      autoDeleteExternalUsers: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastRunAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastRunSummary: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'privacy_configs',
      timestamps: true,
      paranoid: true,
      underscored: true,
    }
  );

  return PrivacyConfig;
};
