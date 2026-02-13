const { pickDefined, buildListOptions, findByPkOrThrow } = require('./_serviceUtils');

class AssetMaintenanceService {
  constructor(models) {
    this.models = models;
  }

  async reportMaintenance(data) {
    const { Asset, AssetMaintenance, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const asset = await Asset.findByPk(data.assetId, { transaction });
      if (!asset) {
        throw new Error('Asset not found');
      }
      return AssetMaintenance.create(
        {
          assetId: data.assetId,
          status: data.status || 'reported',
          reportedAt: data.reportedAt || new Date(),
          completedAt: data.completedAt || null,
          notes: data.notes || null,
        },
        { transaction }
      );
    });
  }

  async getById(id) {
    return findByPkOrThrow(this.models.AssetMaintenance, id, 'AssetMaintenance not found');
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    if (filter.assetId) {
      where.assetId = filter.assetId;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    return this.models.AssetMaintenance.findAll({ where, ...buildListOptions(options) });
  }

  async updateMaintenance(id, updates) {
    const maintenance = await this.getById(id);
    const allowed = pickDefined(updates, ['status', 'reportedAt', 'completedAt', 'notes']);
    await maintenance.update(allowed);
    return maintenance;
  }

  async completeMaintenance(id, completedAt) {
    const maintenance = await this.getById(id);
    await maintenance.update({ status: 'completed', completedAt: completedAt || new Date() });
    return maintenance;
  }

  async deleteMaintenance(id) {
    const maintenance = await this.getById(id);
    await maintenance.destroy();
    return true;
  }
}

module.exports = AssetMaintenanceService;
