class InventoryStockService {
  constructor(models) {
    this.models = models;
  }

  async getStock(assetModelId, lendingLocationId, options = {}) {
    const stock = await this.models.InventoryStock.findOne({
      where: { assetModelId, lendingLocationId },
      transaction: options.transaction,
      lock: options.lock,
    });
    return stock;
  }

  async ensureStock(assetModelId, lendingLocationId, options = {}) {
    const tx = options.transaction;
    let stock = await this.getStock(assetModelId, lendingLocationId, {
      transaction: tx,
      lock: tx ? tx.LOCK.UPDATE : undefined,
    });
    if (!stock) {
      stock = await this.models.InventoryStock.create(
        {
          assetModelId,
          lendingLocationId,
          quantityTotal: 0,
          quantityAvailable: 0,
        },
        { transaction: tx }
      );
    }
    return stock;
  }

  async updateStock(assetModelId, lendingLocationId, updates = {}, options = {}) {
    const tx = options.transaction;
    const stock = await this.ensureStock(assetModelId, lendingLocationId, { transaction: tx });
    const payload = {};
    if (updates.quantityTotal !== undefined) payload.quantityTotal = Math.max(parseInt(updates.quantityTotal, 10) || 0, 0);
    if (updates.quantityAvailable !== undefined) payload.quantityAvailable = Math.max(parseInt(updates.quantityAvailable, 10) || 0, 0);
    if (updates.minThreshold !== undefined) payload.minThreshold = updates.minThreshold === '' ? null : updates.minThreshold;
    if (updates.reorderThreshold !== undefined) payload.reorderThreshold = updates.reorderThreshold === '' ? null : updates.reorderThreshold;
    if (payload.quantityAvailable !== undefined && payload.quantityTotal !== undefined && payload.quantityAvailable > payload.quantityTotal) {
      payload.quantityAvailable = payload.quantityTotal;
    } else if (payload.quantityAvailable !== undefined && payload.quantityTotal === undefined && payload.quantityAvailable > stock.quantityTotal) {
      payload.quantityAvailable = stock.quantityTotal;
    } else if (payload.quantityTotal !== undefined && payload.quantityAvailable === undefined && stock.quantityAvailable > payload.quantityTotal) {
      payload.quantityAvailable = payload.quantityTotal;
    }
    await stock.update(payload, { transaction: tx });
    return stock;
  }

  async increaseAvailable(assetModelId, lendingLocationId, qty, options = {}) {
    const amount = Math.max(parseInt(qty, 10) || 0, 0);
    if (!amount) return this.getStock(assetModelId, lendingLocationId, options);
    const tx = options.transaction;
    const stock = await this.ensureStock(assetModelId, lendingLocationId, { transaction: tx });
    const next = Math.min(stock.quantityAvailable + amount, stock.quantityTotal);
    await stock.update({ quantityAvailable: next }, { transaction: tx });
    return stock;
  }

  async decreaseAvailable(assetModelId, lendingLocationId, qty, options = {}) {
    const amount = Math.max(parseInt(qty, 10) || 0, 0);
    if (!amount) return this.getStock(assetModelId, lendingLocationId, options);
    const tx = options.transaction;
    const stock = await this.ensureStock(assetModelId, lendingLocationId, { transaction: tx });
    if (stock.quantityAvailable < amount) {
      const err = new Error('Nicht genügend Bulk-Bestand verfügbar');
      err.status = 422;
      throw err;
    }
    await stock.update({ quantityAvailable: stock.quantityAvailable - amount }, { transaction: tx });
    return stock;
  }
}

module.exports = InventoryStockService;
