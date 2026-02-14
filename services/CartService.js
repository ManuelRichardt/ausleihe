const crypto = require('crypto');
const { assertOpenForRange } = require('../utils/openingHours');

class CartService {
  constructor(models, availabilityService) {
    this.models = models;
    this.availabilityService = availabilityService;
  }

  getCart(session) {
    if (!session.cart) {
      session.cart = { items: [] };
    }
    if (!Array.isArray(session.cart.items)) {
      session.cart.items = [];
    }
    return session.cart;
  }

  async addItem(session, data) {
    const cart = this.getCart(session);
    const model = await this.models.AssetModel.findByPk(data.assetModelId);
    if (!model) {
      throw new Error('AssetModel not found');
    }

    const quantity = Math.max(parseInt(data.quantity || '1', 10), 1);
    const reservedFrom = data.reservedFrom;
    const reservedUntil = data.reservedUntil;
    if (!reservedFrom || !reservedUntil) {
      throw new Error('Reservierungszeitraum ist erforderlich');
    }

    await assertOpenForRange(this.models, model.lendingLocationId, reservedFrom, reservedUntil);

    await this.availabilityService.assertAvailability(model.id, reservedFrom, reservedUntil, quantity);

    cart.items.push({
      id: crypto.randomUUID(),
      assetModelId: model.id,
      lendingLocationId: model.lendingLocationId,
      quantity,
      reservedFrom,
      reservedUntil,
    });

    return cart;
  }

  async updateItem(session, itemId, updates) {
    const cart = this.getCart(session);
    const item = cart.items.find((entry) => entry.id === itemId);
    if (!item) {
      throw new Error('Cart item not found');
    }

    const model = await this.models.AssetModel.findByPk(item.assetModelId);
    if (!model) {
      throw new Error('AssetModel not found');
    }

    const quantity = updates.quantity !== undefined ? Math.max(parseInt(updates.quantity || '1', 10), 1) : item.quantity;
    const reservedFrom = updates.reservedFrom || item.reservedFrom;
    const reservedUntil = updates.reservedUntil || item.reservedUntil;

    await assertOpenForRange(this.models, model.lendingLocationId, reservedFrom, reservedUntil);

    await this.availabilityService.assertAvailability(model.id, reservedFrom, reservedUntil, quantity);

    item.quantity = quantity;
    item.reservedFrom = reservedFrom;
    item.reservedUntil = reservedUntil;

    return cart;
  }

  removeItem(session, itemId) {
    const cart = this.getCart(session);
    cart.items = cart.items.filter((entry) => entry.id !== itemId);
    return cart;
  }

  clear(session) {
    session.cart = { items: [] };
  }

  async checkout(session, userId, loanService) {
    const cart = this.getCart(session);
    if (!cart.items.length) {
      throw new Error('Cart is empty');
    }

    const groups = new Map();
    for (const item of cart.items) {
      const key = JSON.stringify({
        lendingLocationId: item.lendingLocationId,
        reservedFrom: item.reservedFrom,
        reservedUntil: item.reservedUntil,
      });
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    }

    const createdLoans = [];
    for (const [key, items] of groups.entries()) {
      const parsed = JSON.parse(key);
      const lendingLocationId = parsed.lendingLocationId;
      const reservedFrom = parsed.reservedFrom;
      const reservedUntil = parsed.reservedUntil;
      await assertOpenForRange(this.models, lendingLocationId, reservedFrom, reservedUntil);
      const payloadItems = items.map((item) => ({
        assetModelId: item.assetModelId,
        quantity: item.quantity,
      }));

      const loan = await loanService.createReservation({
        userId,
        lendingLocationId,
        reservedFrom,
        reservedUntil,
        items: payloadItems,
      });

      createdLoans.push(loan);
    }

    this.clear(session);
    return createdLoans;
  }
}

module.exports = CartService;
