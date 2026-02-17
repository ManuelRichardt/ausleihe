module.exports = (sequelize, DataTypes) => {
  const PrivacyDeletionRequest = sequelize.define(
    'PrivacyDeletionRequest',
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
      requestedByUserId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('open', 'in_progress', 'completed', 'rejected'),
        allowNull: false,
        defaultValue: 'open',
      },
      requestNote: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      processNote: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      processedByUserId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      processedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'privacy_deletion_requests',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['status'] },
        { fields: ['requested_by_user_id'] },
        { fields: ['processed_by_user_id'] },
      ],
    }
  );

  PrivacyDeletionRequest.associate = (models) => {
    PrivacyDeletionRequest.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    PrivacyDeletionRequest.belongsTo(models.User, { foreignKey: 'requestedByUserId', as: 'requestedBy' });
    PrivacyDeletionRequest.belongsTo(models.User, { foreignKey: 'processedByUserId', as: 'processedBy' });
  };

  return PrivacyDeletionRequest;
};
