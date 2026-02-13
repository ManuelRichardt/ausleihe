module.exports = (sequelize, DataTypes) => {
  const CustomFieldValue = sequelize.define(
    'CustomFieldValue',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      customFieldDefinitionId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      assetInstanceId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      valueString: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      valueNumber: {
        type: DataTypes.DECIMAL(18, 6),
        allowNull: true,
      },
      valueBoolean: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      valueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
    },
    {
      tableName: 'custom_field_values',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['custom_field_definition_id', 'asset_instance_id'],
        },
        { fields: ['asset_instance_id'] },
        { fields: ['custom_field_definition_id'] },
      ],
      validate: {
        exactlyOneValue() {
          const values = [
            this.valueString,
            this.valueNumber,
            this.valueBoolean,
            this.valueDate,
          ].filter((v) => v !== null && v !== undefined);
          if (values.length !== 1) {
            throw new Error('Exactly one value column must be set');
          }
        },
      },
    }
  );

  CustomFieldValue.associate = (models) => {
    CustomFieldValue.belongsTo(models.CustomFieldDefinition, {
      foreignKey: 'customFieldDefinitionId',
      as: 'definition',
      onDelete: 'RESTRICT',
    });
    CustomFieldValue.belongsTo(models.Asset, {
      foreignKey: 'assetInstanceId',
      as: 'assetInstance',
      onDelete: 'RESTRICT',
    });
  };

  return CustomFieldValue;
};
