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
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      itemType: {
        type: DataTypes.ENUM('serialized', 'bulk', 'bundle_root', 'bundle_component'),
        allowNull: false,
        defaultValue: 'serialized',
      },
      bundleDefinitionId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      parentLoanItemId: {
        type: DataTypes.UUID,
        allowNull: true,
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
        { fields: ['bundle_definition_id'] },
        { fields: ['parent_loan_item_id'] },
        { fields: ['item_type'] },
        { fields: ['status'] },
      ],
    }
  );

  LoanItem.associate = (models) => {
    LoanItem.belongsTo(models.Loan, { foreignKey: 'loanId', as: 'loan' });
    LoanItem.belongsTo(models.Asset, { foreignKey: 'assetId', as: 'asset' });
    LoanItem.belongsTo(models.AssetModel, { foreignKey: 'assetModelId', as: 'assetModel' });
    LoanItem.belongsTo(models.BundleDefinition, { foreignKey: 'bundleDefinitionId', as: 'bundleDefinition' });
    LoanItem.belongsTo(models.LoanItem, { foreignKey: 'parentLoanItemId', as: 'parentItem' });
    LoanItem.hasMany(models.LoanItem, { foreignKey: 'parentLoanItemId', as: 'componentItems' });
  };

  return LoanItem;
};
