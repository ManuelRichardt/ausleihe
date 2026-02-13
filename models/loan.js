module.exports = (sequelize, DataTypes) => {
  const Loan = sequelize.define(
    'Loan',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      lendingLocationId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('reserved', 'cancelled', 'handed_over', 'returned', 'overdue'),
        allowNull: false,
        defaultValue: 'reserved',
      },
      reservedFrom: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      reservedUntil: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      handedOverAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      returnedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'loans',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['lending_location_id'] },
        { fields: ['status'] },
      ],
    }
  );

  Loan.associate = (models) => {
    Loan.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Loan.belongsTo(models.LendingLocation, {
      foreignKey: 'lendingLocationId',
      as: 'lendingLocation',
    });
    Loan.hasMany(models.LoanItem, { foreignKey: 'loanId', as: 'loanItems' });
    Loan.hasMany(models.LoanSignature, { foreignKey: 'loanId', as: 'loanSignatures' });
    Loan.hasMany(models.LoanEvent, { foreignKey: 'loanId', as: 'events' });
  };

  return Loan;
};
