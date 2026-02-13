const { pickDefined, applyIsActiveFilter, buildListOptions, findByPkOrThrow } = require('./_serviceUtils');

class StorageLocationService {
  constructor(models) {
    this.models = models;
  }

  buildCreateStorageLocationPayload(data) {
    return {
      lendingLocationId: data.lendingLocationId,
      name: data.name,
      description: data.description || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };
  }

  pickStorageLocationUpdates(updates) {
    return pickDefined(updates, ['name', 'description', 'isActive']);
  }

  async createStorageLocation(data) {
    const { LendingLocation, StorageLocation, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const location = await LendingLocation.findByPk(data.lendingLocationId, { transaction });
      if (!location) {
        throw new Error('LendingLocation not found');
      }
      const payload = this.buildCreateStorageLocationPayload(data);
      return StorageLocation.create(payload, { transaction });
    });
  }

  async getById(id) {
    return findByPkOrThrow(this.models.StorageLocation, id, 'StorageLocation not found');
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    if (filter.lendingLocationId) {
      where.lendingLocationId = filter.lendingLocationId;
    }
    applyIsActiveFilter(where, filter);
    return this.models.StorageLocation.findAll({ where, ...buildListOptions(options) });
  }

  async updateStorageLocation(id, updates) {
    const storage = await this.getById(id);
    const allowedUpdates = this.pickStorageLocationUpdates(updates);
    await storage.update(allowedUpdates);
    return storage;
  }

  async setActive(id, nextIsActive) {
    if (nextIsActive === undefined) {
      throw new Error('nextIsActive is required');
    }
    const storage = await this.getById(id);
    await storage.update({ isActive: Boolean(nextIsActive) });
    return storage;
  }

  async deleteStorageLocation(id) {
    const storage = await this.getById(id);
    await storage.destroy();
    return true;
  }
}

module.exports = StorageLocationService;
