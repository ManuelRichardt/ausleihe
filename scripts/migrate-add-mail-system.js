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

  if (!(await hasTable(queryInterface, 'mail_configs'))) {
    await queryInterface.createTable('mail_configs', {
      id: {
        type: models.Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      is_enabled: {
        type: models.Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      transport: {
        type: models.Sequelize.ENUM('sendmail'),
        allowNull: false,
        defaultValue: 'sendmail',
      },
      from_email: {
        type: models.Sequelize.STRING(191),
        allowNull: true,
      },
      from_name: {
        type: models.Sequelize.STRING(191),
        allowNull: true,
      },
      reply_to: {
        type: models.Sequelize.STRING(191),
        allowNull: true,
      },
      sendmail_path: {
        type: models.Sequelize.STRING(255),
        allowNull: false,
        defaultValue: '/usr/sbin/sendmail',
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

  if (!(await hasTable(queryInterface, 'mail_templates'))) {
    await queryInterface.createTable('mail_templates', {
      id: {
        type: models.Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      key: {
        type: models.Sequelize.STRING(100),
        allowNull: false,
      },
      subject_de: {
        type: models.Sequelize.STRING(255),
        allowNull: false,
      },
      subject_en: {
        type: models.Sequelize.STRING(255),
        allowNull: false,
      },
      body_de: {
        type: models.Sequelize.TEXT('long'),
        allowNull: false,
      },
      body_en: {
        type: models.Sequelize.TEXT('long'),
        allowNull: false,
      },
      is_active: {
        type: models.Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
    await queryInterface.addIndex('mail_templates', ['key'], { unique: true, name: 'mail_templates_key_unique' });
    await queryInterface.addIndex('mail_templates', ['is_active'], { name: 'mail_templates_is_active_idx' });
  }

  if (!(await hasTable(queryInterface, 'notifications'))) {
    await queryInterface.createTable('notifications', {
      id: {
        type: models.Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: models.Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      email: {
        type: models.Sequelize.STRING(191),
        allowNull: false,
      },
      template_key: {
        type: models.Sequelize.STRING(100),
        allowNull: false,
      },
      locale: {
        type: models.Sequelize.ENUM('de', 'en'),
        allowNull: false,
        defaultValue: 'de',
      },
      subject: {
        type: models.Sequelize.STRING(255),
        allowNull: false,
      },
      body: {
        type: models.Sequelize.TEXT('long'),
        allowNull: false,
      },
      status: {
        type: models.Sequelize.ENUM('pending', 'sent', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error_message: {
        type: models.Sequelize.TEXT,
        allowNull: true,
      },
      metadata_text: {
        type: models.Sequelize.TEXT('long'),
        allowNull: true,
      },
      scheduled_for: {
        type: models.Sequelize.DATE,
        allowNull: true,
      },
      sent_at: {
        type: models.Sequelize.DATE,
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
    await queryInterface.addIndex('notifications', ['user_id'], { name: 'notifications_user_id_idx' });
    await queryInterface.addIndex('notifications', ['status'], { name: 'notifications_status_idx' });
    await queryInterface.addIndex('notifications', ['template_key'], { name: 'notifications_template_key_idx' });
    await queryInterface.addIndex('notifications', ['scheduled_for'], { name: 'notifications_scheduled_for_idx' });
    await queryInterface.addIndex('notifications', ['email'], { name: 'notifications_email_idx' });
  }

  process.stdout.write('Migration completed: mail system\n');
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
