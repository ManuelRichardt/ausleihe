module.exports = (sequelize, DataTypes) => {
  const LoanSignature = sequelize.define(
    'LoanSignature',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      loanId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      signatureType: {
        type: DataTypes.ENUM('handover', 'return'),
        allowNull: false,
      },
      signedByName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      signedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      filePath: {
        type: DataTypes.STRING(512),
        allowNull: false,
      },
      ipAddress: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'loan_signatures',
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [
        { fields: ['loan_id'] },
        { fields: ['user_id'] },
        { fields: ['signature_type'] },
      ],
    }
  );

  LoanSignature.associate = (models) => {
    LoanSignature.belongsTo(models.Loan, { foreignKey: 'loanId', as: 'loan' });
    LoanSignature.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return LoanSignature;
};
