const { services, renderPage, handleError } = require('./controllerUtils');
const { formatDateTime } = require('../../utils/dateFormat');

class CartController {
  async show(req, res, next) {
    try {
      const cart = services.cartService.getCart(req.session);
      const modelIds = cart.items.map((item) => item.assetModelId);
      const models = modelIds.length
        ? await services.assetModelService.getByIds(Array.from(new Set(modelIds)))
        : [];
      const modelMap = models.reduce((acc, model) => {
        acc[model.id] = model;
        return acc;
      }, {});

      const items = cart.items.map((item) => ({
        ...item,
        model: modelMap[item.assetModelId] || null,
      }));

      return renderPage(res, 'cart/index', req, {
        breadcrumbs: [{ label: 'Warenkorb', href: '/cart' }],
        cartItems: items,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async addItem(req, res, next) {
    try {
      await services.cartService.addItem(req.session, {
        kind: req.body.kind,
        assetModelId: req.body.assetModelId,
        bundleDefinitionId: req.body.bundleDefinitionId,
        lendingLocationId: req.body.lendingLocationId,
        quantity: req.body.quantity,
        reservedFrom: req.body.reservedFrom,
        reservedUntil: req.body.reservedUntil,
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Zum Warenkorb hinzugefuegt');
      }
      return res.redirect('/cart');
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message);
      }
      return handleError(res, next, req, err);
    }
  }

  async updateItem(req, res, next) {
    try {
      await services.cartService.updateItem(req.session, req.params.id, {
        quantity: req.body.quantity,
        reservedFrom: req.body.reservedFrom,
        reservedUntil: req.body.reservedUntil,
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Warenkorb aktualisiert');
      }
      return res.redirect('/cart');
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message);
      }
      return handleError(res, next, req, err);
    }
  }

  async removeItem(req, res, next) {
    try {
      services.cartService.removeItem(req.session, req.params.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Eintrag entfernt');
      }
      return res.redirect('/cart');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async checkout(req, res, next) {
    try {
      const loans = await services.cartService.checkout(req.session, req.user.id, services.loanService);
      if (req.user && req.user.email && Array.isArray(loans) && loans.length) {
        for (const loan of loans) {
          try {
            const location = await services.lendingLocationService.getById(loan.lendingLocationId);
            await services.mailService.sendTemplate('reservation_confirmation', {
              userId: req.user.id,
              email: req.user.email,
              locale: req.locale || 'de',
              variables: {
                firstName: req.user.firstName || req.user.username || '',
                loanId: loan.id,
                lendingLocation: location ? location.name : '-',
                reservedFrom: formatDateTime(loan.reservedFrom),
                reservedUntil: formatDateTime(loan.reservedUntil),
              },
              metadata: {
                loanId: loan.id,
                type: 'reservation_confirmation',
              },
            });
          } catch (mailErr) {
            if (typeof req.flash === 'function') {
              req.flash('error', 'Reservierung gespeichert, Benachrichtigung konnte nicht versendet werden.');
            }
          }
        }
      }
      if (typeof req.flash === 'function') {
        req.flash('success', 'Reservierung gesendet');
      }
      if (loans.length === 1) {
        return res.redirect(`/reservations/${loans[0].id}`);
      }
      return res.redirect('/reservations');
    } catch (err) {
      if (typeof req.flash === 'function') {
        req.flash('error', err.message);
      }
      return handleError(res, next, req, err);
    }
  }
}

module.exports = CartController;
