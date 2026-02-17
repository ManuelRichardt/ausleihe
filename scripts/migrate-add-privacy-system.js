const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const models = require('../models');

async function hasTable(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables
    .map((item) => (typeof item === 'string' ? item : item.tableName || item.TABLE_NAME))
    .includes(tableName);
}

async function run() {
  const queryInterface = models.sequelize.getQueryInterface();
  await models.sequelize.authenticate();

  if (!(await hasTable(queryInterface, 'privacy_configs'))) {
    await queryInterface.createTable('privacy_configs', {
      id: {
        type: models.Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      is_enabled: {
        type: models.Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      returned_loan_retention_months: {
        type: models.Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      auto_delete_external_users: {
        type: models.Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_run_at: {
        type: models.Sequelize.DATE,
        allowNull: true,
      },
      last_run_summary: {
        type: models.Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: models.Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: models.Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: models.Sequelize.DATE,
        allowNull: true,
      },
    });
  }

  if (!(await hasTable(queryInterface, 'privacy_deletion_requests'))) {
    await queryInterface.createTable('privacy_deletion_requests', {
      id: {
        type: models.Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: models.Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      requested_by_user_id: {
        type: models.Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      status: {
        type: models.Sequelize.ENUM('open', 'in_progress', 'completed', 'rejected'),
        allowNull: false,
        defaultValue: 'open',
      },
      request_note: {
        type: models.Sequelize.TEXT,
        allowNull: true,
      },
      process_note: {
        type: models.Sequelize.TEXT,
        allowNull: true,
      },
      processed_by_user_id: {
        type: models.Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      processed_at: {
        type: models.Sequelize.DATE,
        allowNull: true,
      },
      metadata: {
        type: models.Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: models.Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: models.Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: models.Sequelize.DATE,
        allowNull: true,
      },
    });
    await queryInterface.addIndex('privacy_deletion_requests', ['user_id'], {
      name: 'privacy_deletion_requests_user_id_idx',
    });
    await queryInterface.addIndex('privacy_deletion_requests', ['status'], {
      name: 'privacy_deletion_requests_status_idx',
    });
    await queryInterface.addIndex('privacy_deletion_requests', ['requested_by_user_id'], {
      name: 'privacy_deletion_requests_requested_by_idx',
    });
    await queryInterface.addIndex('privacy_deletion_requests', ['processed_by_user_id'], {
      name: 'privacy_deletion_requests_processed_by_idx',
    });
  }

  const existingPrivacyConfig = await models.PrivacyConfig.findOne();
  if (!existingPrivacyConfig) {
    await models.PrivacyConfig.create({
      isEnabled: true,
      returnedLoanRetentionMonths: 3,
      autoDeleteExternalUsers: true,
    });
  }

  process.stdout.write('Migration completed: privacy system\n');
  await models.sequelize.close();
}

run().catch(async (err) => {
  process.stderr.write(`${err.message || err}\n`);
  try {
    await models.sequelize.close();
  } catch (closeErr) {
    // ignore
  }
  process.exit(1);
});
