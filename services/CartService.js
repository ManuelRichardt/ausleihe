const crypto = require('crypto');
const { assertOpenForRange } = require('../utils/openingHours');

class CartService {
  constructor(models, availabilityService, bundleService, inventoryStockService) {
    this.models = models;
    this.availabilityService = availabilityService;
    this.bundleService = bundleService;
    this.inventoryStockService = inventoryStockService;
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
    const kind = String(data.kind || '').trim().toLowerCase() || 'serialized';
    const quantity = Math.max(parseInt(data.quantity || '1', 10), 1);
    const reservedFrom = data.reservedFrom;
    const reservedUntil = data.reservedUntil;
    if (!reservedFrom || !reservedUntil) {
      throw new Error('Reservierungszeitraum ist erforderlich');
    }
    if (!['serialized', 'bulk', 'bundle'].includes(kind)) {
      throw new Error('Ungültiger Typ');
    }

    if (kind === 'bundle') {
      if (!data.bundleDefinitionId) {
        throw new Error('Bundle ist erforderlich');
      }
      const bundle = await this.bundleService.getBundleDefinition(data.bundleDefinitionId);
      const lendingLocationId = data.lendingLocationId || bundle.lendingLocationId || (bundle.bundleModel && bundle.bundleModel.lendingLocationId);
      await assertOpenForRange(this.models, lendingLocationId, reservedFrom, reservedUntil);
      const availability = await this.bundleService.computeBundleAvailability(
        data.bundleDefinitionId,
        lendingLocationId,
        { reservedFrom, reservedUntil }
      );
      if (!availability.available) {
        throw new Error('Bundle ist im gewählten Zeitraum nicht verfügbar');
      }
      cart.items.push({
        id: crypto.randomUUID(),
        kind: 'bundle',
        bundleDefinitionId: data.bundleDefinitionId,
        assetModelId: bundle.assetModelId,
        lendingLocationId,
        quantity: 1,
        reservedFrom,
        reservedUntil,
      });
      return cart;
    }

    const model = await this.models.AssetModel.findByPk(data.assetModelId);
    if (!model) {
      throw new Error('AssetModel not found');
    }
    const trackingType = model.trackingType || 'serialized';
    if (kind !== trackingType && !(kind === 'serialized' && trackingType === 'serialized')) {
      throw new Error('Typ passt nicht zum Modell');
    }

    await assertOpenForRange(this.models, model.lendingLocationId, reservedFrom, reservedUntil);

    if (kind === 'bulk') {
      const stock = await this.inventoryStockService.getStock(model.id, model.lendingLocationId);
      const available = stock ? stock.quantityAvailable : 0;
      if (available < quantity) {
        throw new Error('Nicht genügend Bulk-Bestand verfügbar');
      }
    } else {
      await this.availabilityService.assertAvailability(model.id, reservedFrom, reservedUntil, quantity);
    }

    cart.items.push({
      id: crypto.randomUUID(),
      kind,
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

    const quantity =
      item.kind === 'bundle'
        ? 1
        : (updates.quantity !== undefined ? Math.max(parseInt(updates.quantity || '1', 10), 1) : item.quantity);
    const reservedFrom = updates.reservedFrom || item.reservedFrom;
    const reservedUntil = updates.reservedUntil || item.reservedUntil;

    if (item.kind === 'bundle') {
      const bundle = await this.bundleService.getBundleDefinition(item.bundleDefinitionId);
      const lendingLocationId = item.lendingLocationId || bundle.lendingLocationId || (bundle.bundleModel && bundle.bundleModel.lendingLocationId);
      await assertOpenForRange(this.models, lendingLocationId, reservedFrom, reservedUntil);
      const availability = await this.bundleService.computeBundleAvailability(
        item.bundleDefinitionId,
        lendingLocationId,
        { reservedFrom, reservedUntil }
      );
      if (!availability.available) {
        throw new Error('Bundle ist im gewählten Zeitraum nicht verfügbar');
      }
    } else {
      const model = await this.models.AssetModel.findByPk(item.assetModelId);
      if (!model) {
        throw new Error('AssetModel not found');
      }
      await assertOpenForRange(this.models, model.lendingLocationId, reservedFrom, reservedUntil);
      if ((item.kind || model.trackingType) === 'bulk') {
        const stock = await this.inventoryStockService.getStock(model.id, model.lendingLocationId);
        const available = stock ? stock.quantityAvailable : 0;
        if (available < quantity) {
          throw new Error('Nicht genügend Bulk-Bestand verfügbar');
        }
      } else {
        await this.availabilityService.assertAvailability(model.id, reservedFrom, reservedUntil, quantity);
      }
    }

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
        kind: item.kind || 'serialized',
        assetModelId: item.assetModelId,
        bundleDefinitionId: item.bundleDefinitionId || null,
        lendingLocationId: item.lendingLocationId,
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
