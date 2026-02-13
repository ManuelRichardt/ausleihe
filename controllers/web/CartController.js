const { services, renderPage, handleError } = require('./_controllerUtils');

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
        assetModelId: req.body.assetModelId,
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
