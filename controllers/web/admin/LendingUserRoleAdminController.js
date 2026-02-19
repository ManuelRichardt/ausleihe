const { Op } = require('sequelize');
const { services, renderPage, handleError } = require('../controllerUtils');

class LendingUserRoleAdminController {
  buildSearchWhere(query) {
    if (!query) {
      return {};
    }
    const q = `%${String(query).toLowerCase()}%`;
    const { sequelize } = services.models;
    return {
      [Op.or]: [
        sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), { [Op.like]: q }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), { [Op.like]: q }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('first_name')), { [Op.like]: q }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('last_name')), { [Op.like]: q }),
      ],
    };
  }

  getReturnPath(req) {
    const candidate = req.body && typeof req.body.returnTo === 'string' ? req.body.returnTo : '';
    if (candidate && candidate.startsWith('/admin/lending-user-roles')) {
      return candidate;
    }
    return '/admin/lending-user-roles';
  }

  async index(req, res, next) {
    try {
      if (!req.lendingLocationId) {
        const err = new Error('Bitte zuerst eine Ausleihe auswählen.');
        err.status = 422;
        throw err;
      }

      const q = req.query.q ? String(req.query.q).trim() : '';
      const where = this.buildSearchWhere(q);

      const roles = await services.roleService.searchRoles(
        { scope: 'ausleihe' },
        { order: [['name', 'ASC']] }
      );

      const users = await services.models.User.findAll({
        where,
        order: [['lastName', 'ASC'], ['firstName', 'ASC'], ['username', 'ASC']],
        limit: q ? 100 : 50,
        include: [
          {
            model: services.models.UserRole,
            as: 'userRoles',
            required: false,
            where: { lendingLocationId: req.lendingLocationId },
            include: [{ model: services.models.Role, as: 'role' }],
          },
        ],
      });

      const visibleUsers = q
        ? users
        : users.filter((user) => Array.isArray(user.userRoles) && user.userRoles.length > 0);

      return renderPage(res, 'admin/users/lendingRoles', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Benutzerrollen (Ausleihe)', href: '/admin/lending-user-roles' },
        ],
        users: visibleUsers,
        roles,
        query: q,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async assign(req, res, next) {
    try {
      if (!req.lendingLocationId) {
        const err = new Error('Bitte zuerst eine Ausleihe auswählen.');
        err.status = 422;
        throw err;
      }
      const targetUserId = req.params.id;
      const roleId = req.body.roleId;
      if (!roleId) {
        const err = new Error('Bitte eine Rolle auswählen.');
        err.status = 422;
        throw err;
      }
      if (req.user && req.user.id && req.user.id === targetUserId) {
        const err = new Error('Sie dürfen sich selbst keine weiteren Rollen zuweisen.');
        err.status = 422;
        throw err;
      }
      const role = await services.roleService.getById(roleId);
      if (!role || role.scope !== 'ausleihe') {
        const err = new Error('Nur Rollen mit Scope "ausleihe" sind erlaubt.');
        err.status = 422;
        throw err;
      }

      await services.userService.assignRole(
        {
          userId: targetUserId,
          roleId: role.id,
          lendingLocationId: req.lendingLocationId,
        },
        { actorId: req.user ? req.user.id : null }
      );

      if (typeof req.flash === 'function') {
        req.flash('success', 'Rolle zugewiesen.');
      }
      return res.redirect(this.getReturnPath(req));
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message || 'Rolle konnte nicht zugewiesen werden.');
      }
      return res.redirect(this.getReturnPath(req));
    }
  }

  async revoke(req, res, next) {
    try {
      if (!req.lendingLocationId) {
        const err = new Error('Bitte zuerst eine Ausleihe auswählen.');
        err.status = 422;
        throw err;
      }
      const targetUserId = req.params.id;
      const roleId = req.params.roleId;
      if (req.user && req.user.id && req.user.id === targetUserId) {
        const err = new Error('Sie dürfen Ihre eigenen Rollen hier nicht ändern.');
        err.status = 422;
        throw err;
      }
      const role = await services.roleService.getById(roleId);
      if (!role || role.scope !== 'ausleihe') {
        const err = new Error('Nur Rollen mit Scope "ausleihe" sind erlaubt.');
        err.status = 422;
        throw err;
      }

      await services.userService.revokeRole(
        {
          userId: targetUserId,
          roleId: role.id,
          lendingLocationId: req.lendingLocationId,
        },
        { actorId: req.user ? req.user.id : null }
      );

      if (typeof req.flash === 'function') {
        req.flash('success', 'Rolle entfernt.');
      }
      return res.redirect(this.getReturnPath(req));
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message || 'Rolle konnte nicht entfernt werden.');
      }
      return res.redirect(this.getReturnPath(req));
    }
  }
}

module.exports = LendingUserRoleAdminController;
