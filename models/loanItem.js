module.exports = (sequelize, DataTypes) => {
  const LoanItem = sequelize.define(
    'LoanItem',
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
      assetId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      assetModelId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('reserved', 'handed_over', 'returned', 'lost', 'damaged'),
        allowNull: false,
        defaultValue: 'reserved',
      },
      conditionOnHandover: {
        type: DataTypes.ENUM('new', 'good', 'fair', 'damaged', 'lost'),
        allowNull: true,
      },
      conditionOnReturn: {
        type: DataTypes.ENUM('new', 'good', 'fair', 'damaged', 'lost'),
        allowNull: true,
      },
      handedOverAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      returnedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'loan_items',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { fields: ['loan_id'] },
        { fields: ['asset_id'] },
        { fields: ['asset_model_id'] },
        { fields: ['status'] },
      ],
    }
  );

  LoanItem.associate = (models) => {
    LoanItem.belongsTo(models.Loan, { foreignKey: 'loanId', as: 'loan' });
    LoanItem.belongsTo(models.Asset, { foreignKey: 'assetId', as: 'asset' });
    LoanItem.belongsTo(models.AssetModel, { foreignKey: 'assetModelId', as: 'assetModel' });
  };

  return LoanItem;
};
