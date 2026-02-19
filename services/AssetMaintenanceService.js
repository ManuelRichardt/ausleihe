const { pickDefined, buildListOptions, findByPkOrThrow } = require('./serviceUtils');

class AssetMaintenanceService {
  constructor(models) {
    this.models = models;
  }

  appendActionNote(existingNotes, actionLabel, note, occurredAt) {
    const timestamp = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
    const prefix = Number.isNaN(timestamp.getTime())
      ? `[${actionLabel}]`
      : `[${timestamp.toISOString()}] ${actionLabel}`;
    const cleanNote = (note || '').trim();
    const line = cleanNote ? `${prefix}: ${cleanNote}` : prefix;
    return [existingNotes || '', line].filter(Boolean).join('\n');
  }

  async reportMaintenance(data) {
    const { Asset, AssetMaintenance, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      const asset = await Asset.findByPk(data.assetId, { transaction });
      if (!asset) {
        throw new Error('Asset not found');
      }
      const reportedAt = data.reportedAt || new Date();
      return AssetMaintenance.create(
        {
          assetId: data.assetId,
          status: 'reported',
          reportedAt,
          completedAt: data.completedAt || null,
          notes: this.appendActionNote(null, 'reported', data.notes, reportedAt),
        },
        { transaction }
      );
    });
  }

  async getById(id, options = {}) {
    const findOptions = {};
    if (options.includeDeleted) {
      findOptions.paranoid = false;
    }
    return findByPkOrThrow(this.models.AssetMaintenance, id, 'AssetMaintenance not found', findOptions);
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    if (filter.assetId) {
      where.assetId = filter.assetId;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    return this.models.AssetMaintenance.findAll({
      where,
      ...buildListOptions(options),
    });
  }

  async listByAsset(assetId, options = {}) {
    return this.getAll(
      { assetId },
      {
        ...options,
        order: options.order || [['reportedAt', 'DESC'], ['createdAt', 'DESC']],
      }
    );
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

  async transitionMaintenance(id, nextStatus, note, occurredAt) {
    const maintenance = await this.getById(id);
    const currentStatus = maintenance.status;
    const transitions = {
      reported: ['in_progress', 'completed'],
      in_progress: ['completed'],
      completed: [],
      cancelled: [],
    };
    if (!Object.prototype.hasOwnProperty.call(transitions, currentStatus)) {
      const err = new Error('Invalid maintenance status');
      err.status = 422;
      throw err;
    }
    if (!transitions[currentStatus].includes(nextStatus)) {
      const err = new Error(`Invalid maintenance status transition (${currentStatus} -> ${nextStatus})`);
      err.status = 422;
      throw err;
    }

    const now = occurredAt || new Date();
    const updatePayload = {
      status: nextStatus,
      notes: this.appendActionNote(maintenance.notes, nextStatus, note, now),
    };
    if (nextStatus === 'completed') {
      updatePayload.completedAt = now;
    }
    await maintenance.update(updatePayload);
    return maintenance;
  }

  async deleteMaintenance(id) {
    const maintenance = await this.getById(id);
    await maintenance.destroy();
    return true;
  }
}

module.exports = AssetMaintenanceService;
