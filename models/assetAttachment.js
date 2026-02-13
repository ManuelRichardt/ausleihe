module.exports = (sequelize, DataTypes) => {
  const AssetAttachment = sequelize.define(
    'AssetAttachment',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      assetModelId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      assetId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      kind: {
        type: DataTypes.ENUM('image', 'manual', 'document', 'other'),
        allowNull: false,
        defaultValue: 'image',
      },
      url: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      isPrimary: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'asset_attachments',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { fields: ['asset_model_id'] },
        { fields: ['asset_id'] },
        { fields: ['kind'] },
      ],
    }
  );

  AssetAttachment.associate = (models) => {
    AssetAttachment.belongsTo(models.AssetModel, {
      foreignKey: 'assetModelId',
      as: 'assetModel',
    });
    AssetAttachment.belongsTo(models.Asset, { foreignKey: 'assetId', as: 'asset' });
  };

  return AssetAttachment;
};
