module.exports = (sequelize, DataTypes) => {
  const CustomFieldDefinition = sequelize.define(
    'CustomFieldDefinition',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      scope: {
        type: DataTypes.ENUM('global', 'asset_model', 'lending_location'),
        allowNull: false,
      },
      assetModelId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      lendingLocationId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      key: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM('string', 'text', 'number', 'boolean', 'date', 'enum'),
        allowNull: false,
      },
      enumValues: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      defaultValue: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'custom_field_definitions',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        {
          name: 'cfd_scope_key_model_loc',
          unique: true,
          fields: ['scope', 'key', 'asset_model_id', 'lending_location_id'],
        },
        { fields: ['asset_model_id'] },
        { fields: ['lending_location_id'] },
        { fields: ['scope'] },
      ],
      validate: {
        scopeTarget() {
          const hasAssetModel = Boolean(this.assetModelId);
          const hasLendingLocation = Boolean(this.lendingLocationId);
          if (this.scope === 'global') {
            if (hasAssetModel || hasLendingLocation) {
              throw new Error('Global scope must not have assetModelId or lendingLocationId');
            }
            return;
          }
          if (hasAssetModel === hasLendingLocation) {
            throw new Error('Exactly one of assetModelId or lendingLocationId must be set');
          }
          if (this.scope === 'asset_model' && !hasAssetModel) {
            throw new Error('assetModelId is required for asset_model scope');
          }
          if (this.scope === 'lending_location' && !hasLendingLocation) {
            throw new Error('lendingLocationId is required for lending_location scope');
          }
        },
        enumValuesOnlyForEnum() {
          if (this.type === 'enum') {
            if (!Array.isArray(this.enumValues) || this.enumValues.length === 0) {
              throw new Error('enumValues must be a non-empty array for enum type');
            }
          } else if (this.enumValues) {
            throw new Error('enumValues is only allowed for enum type');
          }
        },
      },
    }
  );

  CustomFieldDefinition.associate = (models) => {
    CustomFieldDefinition.belongsTo(models.AssetModel, {
      foreignKey: 'assetModelId',
      as: 'assetModel',
      onDelete: 'RESTRICT',
    });
    CustomFieldDefinition.belongsTo(models.LendingLocation, {
      foreignKey: 'lendingLocationId',
      as: 'lendingLocation',
      onDelete: 'RESTRICT',
    });
    CustomFieldDefinition.hasMany(models.CustomFieldValue, {
      foreignKey: 'customFieldDefinitionId',
      as: 'values',
      onDelete: 'RESTRICT',
    });
  };

  return CustomFieldDefinition;
};
