const { InstallationService, INSTALLATION_KEY } = require('../../services/InstallationService');
const { validatePasswordPolicy } = require('../../utils/passwordPolicy');
const { renderPage, handleError } = require('./controllerUtils');
const models = require('../../models');

class InstallController {
  buildDefaultFormData() {
    return {
      adminUsername: '',
      adminEmail: '',
      adminFirstName: 'System',
      adminLastName: 'Administrator',
    };
  }

  async isInstallationCompleted() {
    const existingInstallation = await models.Installation.findOne({
      where: { key: INSTALLATION_KEY },
      attributes: ['id'],
    });
    return Boolean(existingInstallation);
  }

  redirectAlreadyInstalled(req, res) {
    if (typeof req.flash === 'function') {
      req.flash('info', 'Installation ist bereits abgeschlossen.');
    }
    return res.redirect('/login');
  }

  async show(req, res, next) {
    try {
      if (await this.isInstallationCompleted()) {
        return this.redirectAlreadyInstalled(req, res);
      }
      return renderPage(res, 'system/install', req, {
        breadcrumbs: [{ label: 'Installation', href: '/install' }],
        formData: this.buildDefaultFormData(),
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async submit(req, res, next) {
    try {
      if (await this.isInstallationCompleted()) {
        return this.redirectAlreadyInstalled(req, res);
      }

      const admin = {
        username: req.body.adminUsername || '',
        email: req.body.adminEmail || '',
        password: req.body.adminPassword || '',
        firstName: req.body.adminFirstName || 'System',
        lastName: req.body.adminLastName || 'Administrator',
      };

      const errors = {};
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
          formData: { ...this.buildDefaultFormData(), ...req.body },
        });
      }

      const installer = new InstallationService(models);

      await installer.runInitialInstallation({
        adminUsername: admin.username,
        adminEmail: admin.email,
        adminPassword: admin.password,
        adminFirstName: admin.firstName,
        adminLastName: admin.lastName,
      });

      if (typeof req.flash === 'function') {
        req.flash('success', 'Installation abgeschlossen. Bitte Server neu starten.');
      }
      return res.redirect('/login');
    } catch (err) {
      if (err && (err.code === 'INSTALLATION_ALREADY_COMPLETED' || err.message === 'Installation already completed')) {
        return this.redirectAlreadyInstalled(req, res);
      }
      return handleError(res, next, req, err);
    }
  }
}

module.exports = InstallController;
