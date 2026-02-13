module.exports = (sequelize, DataTypes) => {
  const LoanEvent = sequelize.define(
    'LoanEvent',
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
      type: {
        type: DataTypes.ENUM(
          'reserved',
          'cancelled',
          'handed_over',
          'returned',
          'overdue',
          'item_added',
          'item_removed'
        ),
        allowNull: false,
      },
      occurredAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'loan_events',
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [
        { fields: ['loan_id'] },
        { fields: ['user_id'] },
        { fields: ['type'] },
      ],
    }
  );

  LoanEvent.associate = (models) => {
    LoanEvent.belongsTo(models.Loan, { foreignKey: 'loanId', as: 'loan' });
    LoanEvent.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return LoanEvent;
};
