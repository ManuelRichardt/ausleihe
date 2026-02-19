const { pickDefined, buildListOptions, findByPkOrThrow } = require('./serviceUtils');

class AssetAttachmentService {
  constructor(models) {
    this.models = models;
  }

  async addAttachment(data) {
    const { AssetModel, Asset, AssetAttachment, sequelize } = this.models;
    return sequelize.transaction(async (transaction) => {
      if (!data.assetModelId && !data.assetId) {
        throw new Error('AssetModelId or AssetId is required');
      }
      if (data.assetModelId) {
        const model = await AssetModel.findByPk(data.assetModelId, { transaction });
        if (!model) {
          throw new Error('AssetModel not found');
        }
      }
      if (data.assetId) {
        const asset = await Asset.findByPk(data.assetId, { transaction });
        if (!asset) {
          throw new Error('Asset not found');
        }
      }
      return AssetAttachment.create(
        {
          assetModelId: data.assetModelId || null,
          assetId: data.assetId || null,
          kind: data.kind || 'image',
          url: data.url,
          title: data.title || null,
          isPrimary: data.isPrimary !== undefined ? data.isPrimary : false,
        },
        { transaction }
      );
    });
  }

  async getById(id) {
    return findByPkOrThrow(this.models.AssetAttachment, id, 'AssetAttachment not found');
  }

  async getAll(filter = {}, options = {}) {
    const where = {};
    if (filter.assetModelId) {
      where.assetModelId = filter.assetModelId;
    }
    if (filter.assetId) {
      where.assetId = filter.assetId;
    }
    if (filter.kind) {
      where.kind = filter.kind;
    }
    return this.models.AssetAttachment.findAll({ where, ...buildListOptions(options) });
  }

  async updateAttachment(id, updates) {
    const attachment = await this.getById(id);
    const allowed = pickDefined(updates, ['kind', 'url', 'title', 'isPrimary']);
    await attachment.update(allowed);
    return attachment;
  }

  async deleteAttachment(id) {
    const attachment = await this.getById(id);
    await attachment.destroy();
    return true;
  }
}

module.exports = AssetAttachmentService;
