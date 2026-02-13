const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const { InstallationService } = require('../../services/InstallationService');
const loadModels = require('../../utils/loadModels');
const { validatePasswordPolicy } = require('../../utils/passwordPolicy');
const { renderPage, handleError } = require('./_controllerUtils');

class InstallController {
  async show(req, res, next) {
    try {
      return renderPage(res, 'system/install', req, {
        breadcrumbs: [{ label: 'Installation', href: '/install' }],
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async submit(req, res, next) {
    try {
      const dbConfig = {
        host: req.body.dbHost || 'localhost',
        port: parseInt(req.body.dbPort || '3306', 10),
        name: req.body.dbName || '',
        user: req.body.dbUser || '',
        password: req.body.dbPassword || '',
        dialect: req.body.dbDialect || 'mariadb',
      };
      const admin = {
        username: req.body.adminUsername || '',
        email: req.body.adminEmail || '',
        password: req.body.adminPassword || '',
        firstName: req.body.adminFirstName || 'System',
        lastName: req.body.adminLastName || 'Administrator',
      };

      const errors = {};
      if (!dbConfig.name) errors.dbName = 'Datenbankname ist erforderlich';
      if (!dbConfig.user) errors.dbUser = 'DB Benutzer ist erforderlich';
      if (!dbConfig.host) errors.dbHost = 'DB Host ist erforderlich';
      if (!admin.username) errors.adminUsername = 'Admin Benutzername ist erforderlich';
      if (!admin.email) errors.adminEmail = 'Admin E-Mail ist erforderlich';
      if (!admin.password) errors.adminPassword = 'Admin Passwort ist erforderlich';
      try {
        if (admin.password) {
          validatePasswordPolicy(admin.password);
        }
      } catch (err) {
        errors.adminPassword = err.message;
      }

      if (Object.keys(errors).length) {
        res.status(422);
        return renderPage(res, 'system/install', req, {
          errors,
          formData: req.body,
        });
      }

      const sequelize = new Sequelize(dbConfig.name, dbConfig.user, dbConfig.password, {
        host: dbConfig.host,
        port: Number.isNaN(dbConfig.port) ? 3306 : dbConfig.port,
        dialect: dbConfig.dialect,
        logging: false,
      });

      const models = loadModels(sequelize);
      const installer = new InstallationService(models);

      await installer.run({
        adminUsername: admin.username,
        adminEmail: admin.email,
        adminPassword: admin.password,
        adminFirstName: admin.firstName,
        adminLastName: admin.lastName,
      });

      await this.writeEnv(dbConfig);

      if (typeof req.flash === 'function') {
        req.flash('success', 'Installation abgeschlossen. Bitte Server neu starten.');
      }
      return res.redirect('/login');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async writeEnv(dbConfig) {
    const envPath = path.join(__dirname, '..', '..', '.env');
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const lines = existing.split(/\r?\n/).filter(Boolean);
    const map = {};
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx > -1) {
        const key = line.slice(0, idx);
        map[key] = line.slice(idx + 1);
      }
    }

    map.DB_HOST = dbConfig.host;
    map.DB_PORT = String(dbConfig.port || 3306);
    map.DB_NAME = dbConfig.name;
    map.DB_USER = dbConfig.user;
    map.DB_PASSWORD = dbConfig.password;
    map.DB_DIALECT = dbConfig.dialect;

    const output = Object.keys(map)
      .sort()
      .map((key) => `${key}=${map[key]}`)
      .join('\n');
    fs.writeFileSync(envPath, `${output}\n`, 'utf8');
  }
}

module.exports = InstallController;
