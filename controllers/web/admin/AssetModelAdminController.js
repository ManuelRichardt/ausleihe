const {
  services,
  renderPage,
  handleError,
  parseListQuery,
  parseIncludeDeleted,
  buildPagination,
} = require('../_controllerUtils');

class AssetModelAdminController {
  async index(req, res, next) {
    try {
      const { page, limit, offset, order, sortBy, sortOrder } = parseListQuery(
        req,
        ['name', 'createdAt', 'isActive'],
        { order: [['name', 'ASC']] }
      );
      const filter = { lendingLocationId: req.lendingLocationId || undefined };
      const includeDeleted = parseIncludeDeleted(req);
      if (req.query.q) {
        filter.query = req.query.q;
      }
      if (req.query.status === 'active') {
        filter.isActive = true;
      }
      if (req.query.status === 'blocked') {
        filter.isActive = false;
      }
      if (req.query.manufacturerId) {
        filter.manufacturerId = req.query.manufacturerId;
      }
      if (req.query.categoryId) {
        filter.categoryId = req.query.categoryId;
      }
      if (includeDeleted) {
        filter.includeDeleted = true;
      }

      const total = await services.assetModelService.countAssetModels(filter);
      const models = await services.assetModelService.getAll(filter, { limit, offset, order });
      const manufacturers = await services.manufacturerService.getAll({ lendingLocationId: req.lendingLocationId, isActive: true });
      const categories = await services.assetCategoryService.getAll({ lendingLocationId: req.lendingLocationId, isActive: true });

      return renderPage(res, 'admin/models/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Asset Models', href: '/admin/asset-models' },
        ],
        models,
        manufacturers,
        categories,
        filters: {
          q: req.query.q || '',
          status: req.query.status || '',
          manufacturerId: req.query.manufacturerId || '',
          categoryId: req.query.categoryId || '',
          includeDeleted: includeDeleted ? '1' : '',
          sortBy,
          sortOrder,
        },
        pagination: buildPagination(page, limit, total),
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async show(req, res, next) {
    try {
      const model = await services.assetModelService.getById(req.params.id);
      if (req.lendingLocationId && model.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetModel not found');
        err.status = 404;
        throw err;
      }
      const customFieldDefinitions = await services.assetModelService.getGlobalCustomFieldDefinitions({
        onlyActive: false,
      });
      const stock = await services.inventoryStockService.getStock(model.id, model.lendingLocationId);
      const bundleDefinition = await services.bundleService.getByAssetModel(model.id, model.lendingLocationId);
      return renderPage(res, 'admin/models/show', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Asset Models', href: '/admin/asset-models' },
          { label: model.name, href: `/admin/asset-models/${model.id}` },
        ],
        model,
        customFieldDefinitions,
        stock,
        bundleDefinition,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async new(req, res, next) {
    try {
      const manufacturers = res.locals.viewData && res.locals.viewData.manufacturers
        ? res.locals.viewData.manufacturers
        : await services.manufacturerService.getAll({ lendingLocationId: req.lendingLocationId, isActive: true });
      const categories = res.locals.viewData && res.locals.viewData.categories
        ? res.locals.viewData.categories
        : await services.assetCategoryService.getAll({ lendingLocationId: req.lendingLocationId, isActive: true });
      const customFieldDefinitions = res.locals.viewData && res.locals.viewData.customFieldDefinitions
        ? res.locals.viewData.customFieldDefinitions
        : await services.assetModelService.getGlobalCustomFieldDefinitions({ onlyActive: true });
      const componentModels = res.locals.viewData && res.locals.viewData.componentModels
        ? res.locals.viewData.componentModels
        : (await services.assetModelService.getAll({
          lendingLocationId: req.lendingLocationId,
          isActive: true,
        }, { order: [['name', 'ASC']] })).filter((entry) => (entry.trackingType || 'serialized') !== 'bundle');
      return renderPage(res, 'admin/models/new', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Asset Models', href: '/admin/asset-models' },
          { label: 'New', href: '/admin/asset-models/new' },
        ],
        manufacturers,
        categories,
        customFieldDefinitions,
        componentModels,
        stock: null,
        bundleDefinition: null,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      const customFieldData = await services.assetModelService.resolveCustomFieldData(req.body.customFields || {});
      const trackingType = req.body.trackingType || 'serialized';
      const model = await services.assetModelService.createAssetModel({
        lendingLocationId: req.lendingLocationId,
        manufacturerId: req.body.manufacturerId,
        categoryId: req.body.categoryId,
        name: req.body.name,
        description: req.body.description,
        technicalDescription: req.body.technicalDescription,
        specs: customFieldData,
        trackingType,
        isActive: req.body.isActive !== 'false',
      });
      if (trackingType === 'bulk') {
        await services.inventoryStockService.updateStock(model.id, model.lendingLocationId, {
          quantityTotal: req.body.quantityTotal,
          quantityAvailable: req.body.quantityAvailable,
          minThreshold: req.body.minThreshold,
          reorderThreshold: req.body.reorderThreshold,
        });
      }
      await this.syncBundleDefinition(model, req.body);
      await this.attachFiles(model, req.files);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Asset Model angelegt');
      }
      return res.redirect(`/admin/asset-models/${model.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const model = res.locals.viewData && res.locals.viewData.model
        ? res.locals.viewData.model
        : await services.assetModelService.getById(req.params.id);
      if (req.lendingLocationId && model.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetModel not found');
        err.status = 404;
        throw err;
      }
      const manufacturers = res.locals.viewData && res.locals.viewData.manufacturers
        ? res.locals.viewData.manufacturers
        : await services.manufacturerService.getAll({ lendingLocationId: req.lendingLocationId, isActive: true });
      const categories = res.locals.viewData && res.locals.viewData.categories
        ? res.locals.viewData.categories
        : await services.assetCategoryService.getAll({ lendingLocationId: req.lendingLocationId, isActive: true });
      const customFieldDefinitions = res.locals.viewData && res.locals.viewData.customFieldDefinitions
        ? res.locals.viewData.customFieldDefinitions
        : await services.assetModelService.getGlobalCustomFieldDefinitions({ onlyActive: true });
      const stock = await services.inventoryStockService.getStock(model.id, model.lendingLocationId);
      const componentModels = res.locals.viewData && res.locals.viewData.componentModels
        ? res.locals.viewData.componentModels
        : (await services.assetModelService.getAll({
          lendingLocationId: req.lendingLocationId,
          isActive: true,
        }, { order: [['name', 'ASC']] })).filter((entry) => (entry.trackingType || 'serialized') !== 'bundle');
      const bundleDefinition = res.locals.viewData && res.locals.viewData.bundleDefinition
        ? res.locals.viewData.bundleDefinition
        : await services.bundleService.getByAssetModel(model.id, model.lendingLocationId);
      return renderPage(res, 'admin/models/edit', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Asset Models', href: '/admin/asset-models' },
          { label: model.name, href: `/admin/asset-models/${model.id}` },
          { label: 'Edit', href: `/admin/asset-models/${model.id}/edit` },
        ],
        model,
        manufacturers,
        categories,
        customFieldDefinitions,
        stock,
        componentModels,
        bundleDefinition,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async update(req, res, next) {
    try {
      const model = res.locals.viewData && res.locals.viewData.model
        ? res.locals.viewData.model
        : await services.assetModelService.getById(req.params.id);
      if (req.lendingLocationId && model.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetModel not found');
        err.status = 404;
        throw err;
      }
      const customFieldData = await services.assetModelService.resolveCustomFieldData(req.body.customFields || {});
      const trackingType = req.body.trackingType || 'serialized';
      const updatedModel = await services.assetModelService.updateAssetModel(model.id, {
        manufacturerId: req.body.manufacturerId,
        categoryId: req.body.categoryId,
        name: req.body.name,
        description: req.body.description,
        technicalDescription: req.body.technicalDescription,
        specs: customFieldData,
        trackingType,
        isActive: req.body.isActive !== 'false',
      });
      if (trackingType === 'bulk') {
        await services.inventoryStockService.updateStock(updatedModel.id, updatedModel.lendingLocationId, {
          quantityTotal: req.body.quantityTotal,
          quantityAvailable: req.body.quantityAvailable,
          minThreshold: req.body.minThreshold,
          reorderThreshold: req.body.reorderThreshold,
        });
      }
      await this.syncBundleDefinition(updatedModel, req.body);
      await this.attachFiles(updatedModel, req.files);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Asset Model gespeichert');
      }
      return res.redirect(`/admin/asset-models/${updatedModel.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async remove(req, res, next) {
    try {
      const model = await services.assetModelService.getById(req.params.id);
      if (req.lendingLocationId && model.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetModel not found');
        err.status = 404;
        throw err;
      }
      await services.assetModelService.deleteAssetModel(model.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Asset Model gelöscht');
      }
      return res.redirect('/admin/asset-models');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async restore(req, res, next) {
    try {
      const includeDeleted = parseIncludeDeleted(req) || req.body.includeDeleted === '1';
      const model = await services.assetModelService.getById(req.params.id, { includeDeleted: true });
      if (req.lendingLocationId && model.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetModel not found');
        err.status = 404;
        throw err;
      }
      await services.assetModelService.restoreAssetModel(model.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Asset Model wiederhergestellt');
      }
      return res.redirect(includeDeleted ? '/admin/asset-models?includeDeleted=1' : '/admin/asset-models');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async updateAttachment(req, res, next) {
    try {
      const model = await services.assetModelService.getById(req.params.id);
      if (req.lendingLocationId && model.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetModel not found');
        err.status = 404;
        throw err;
      }
      const attachment = await services.assetAttachmentService.getById(req.params.attachmentId);
      if (attachment.assetModelId !== model.id) {
        const err = new Error('Attachment not found');
        err.status = 404;
        throw err;
      }

      const nextKind = req.body.kind || attachment.kind;
      const nextTitle = req.body.title || null;
      const makePrimary = req.body.isPrimary === '1' || req.body.isPrimary === 'true' || req.body.isPrimary === true;

      await services.assetAttachmentService.updateAttachment(attachment.id, {
        kind: nextKind,
        title: nextTitle,
      });

      if (nextKind === 'image' && makePrimary) {
        const images = await services.assetAttachmentService.getAll({
          assetModelId: model.id,
          kind: 'image',
        });
        for (const image of images) {
          await services.assetAttachmentService.updateAttachment(image.id, { isPrimary: image.id === attachment.id });
        }
      }

      await this.syncModelImageUrl(model.id);

      if (typeof req.flash === 'function') {
        req.flash('success', 'Anhang gespeichert');
      }
      return res.redirect(`/admin/asset-models/${model.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async removeAttachment(req, res, next) {
    try {
      const model = await services.assetModelService.getById(req.params.id);
      if (req.lendingLocationId && model.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetModel not found');
        err.status = 404;
        throw err;
      }
      const attachment = await services.assetAttachmentService.getById(req.params.attachmentId);
      if (attachment.assetModelId !== model.id) {
        const err = new Error('Attachment not found');
        err.status = 404;
        throw err;
      }

      await services.assetAttachmentService.deleteAttachment(attachment.id);
      await this.syncModelImageUrl(model.id);

      if (typeof req.flash === 'function') {
        req.flash('success', 'Anhang gelöscht');
      }
      return res.redirect(`/admin/asset-models/${model.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async attachFiles(model, files) {
    if (!files) {
      return;
    }
    const groupedFiles = files || {};
    const images = Array.isArray(groupedFiles.images) ? groupedFiles.images : [];
    const manuals = Array.isArray(groupedFiles.manuals) ? groupedFiles.manuals : [];
    const documents = Array.isArray(groupedFiles.documents) ? groupedFiles.documents : [];
    const others = Array.isArray(groupedFiles.others) ? groupedFiles.others : [];

    if (!images.length && !manuals.length && !documents.length && !others.length) {
      return;
    }

    const existingImages = await services.assetAttachmentService.getAll({
      assetModelId: model.id,
      kind: 'image',
    });
    let hasPrimary = existingImages.some((item) => item.isPrimary);

    for (const file of images) {
      const url = `/uploads/asset-models/${file.filename}`;
      const isPrimary = !hasPrimary;
      await services.assetAttachmentService.addAttachment({
        assetModelId: model.id,
        kind: 'image',
        url,
        isPrimary,
      });
      if (!hasPrimary) {
        hasPrimary = true;
        if (!model.imageUrl) {
          await services.assetModelService.updateAssetModel(model.id, { imageUrl: url });
        }
      }
    }

    for (const file of manuals) {
      await services.assetAttachmentService.addAttachment({
        assetModelId: model.id,
        kind: 'manual',
        url: `/uploads/asset-models/${file.filename}`,
        title: file.originalname || null,
        isPrimary: false,
      });
    }

    for (const file of documents) {
      await services.assetAttachmentService.addAttachment({
        assetModelId: model.id,
        kind: 'document',
        url: `/uploads/asset-models/${file.filename}`,
        title: file.originalname || null,
        isPrimary: false,
      });
    }

    for (const file of others) {
      await services.assetAttachmentService.addAttachment({
        assetModelId: model.id,
        kind: 'other',
        url: `/uploads/asset-models/${file.filename}`,
        title: file.originalname || null,
        isPrimary: false,
      });
    }
  }

  async syncModelImageUrl(modelId) {
    const model = await services.assetModelService.getById(modelId);
    const images = await services.assetAttachmentService.getAll({
      assetModelId: modelId,
      kind: 'image',
    });
    if (!images.length) {
      await services.assetModelService.updateAssetModel(modelId, { imageUrl: null });
      return;
    }
    const primary = images.find((item) => item.isPrimary) || images[0];
    if (!primary.isPrimary) {
      await services.assetAttachmentService.updateAttachment(primary.id, { isPrimary: true });
    }
    if (model.imageUrl !== primary.url) {
      await services.assetModelService.updateAssetModel(modelId, { imageUrl: primary.url });
    }
  }

  parseBundleComponents(body) {
    const toArray = (value) => {
      if (Array.isArray(value)) {
        return value;
      }
      if (value && typeof value === 'object') {
        return Object.values(value);
      }
      if (value === undefined || value === null || value === '') {
        return [];
      }
      if (typeof value === 'string' && value.includes(',')) {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
      }
      return [value];
    };
    const componentIds = toArray(
      body.componentAssetModelId !== undefined
        ? body.componentAssetModelId
        : body['componentAssetModelId[]']
    );
    const quantities = toArray(
      body.componentQuantity !== undefined
        ? body.componentQuantity
        : body['componentQuantity[]']
    );
    const optionalFlags = toArray(
      body.componentIsOptional !== undefined
        ? body.componentIsOptional
        : body['componentIsOptional[]']
    );
    const items = [];
    for (let i = 0; i < componentIds.length; i += 1) {
      const componentAssetModelId = String(componentIds[i] || '').trim();
      if (!componentAssetModelId) {
        continue;
      }
      const quantity = Math.max(parseInt(quantities[i] || '1', 10), 1);
      const isOptionalRaw = String(optionalFlags[i] || '0').trim().toLowerCase();
      const isOptional = ['1', 'true', 'yes', 'ja', 'on'].includes(isOptionalRaw);
      items.push({
        componentAssetModelId,
        quantity,
        isOptional,
      });
    }
    return items;
  }

  async syncBundleDefinition(model, body) {
    const trackingType = model.trackingType || 'serialized';
    const existing = await services.bundleService.getByAssetModel(model.id, model.lendingLocationId);
    if (trackingType !== 'bundle') {
      if (existing) {
        await services.bundleService.deleteBundleDefinition(existing.id);
      }
      return null;
    }

    const bundleName = body.bundleName || model.name;
    const bundleDescription = body.bundleDescription || model.description || null;
    let bundle = existing;
    if (!bundle) {
      bundle = await services.bundleService.createBundleDefinition({
        assetModelId: model.id,
        lendingLocationId: model.lendingLocationId,
        name: bundleName,
        description: bundleDescription,
      });
    } else {
      await services.bundleService.updateBundleDefinition(bundle.id, {
        name: bundleName,
        description: bundleDescription,
      });
    }

    const items = this.parseBundleComponents(body);
    await services.bundleService.replaceBundleItems(bundle.id, items);
    return bundle;
  }

  async updateStock(req, res, next) {
    try {
      const model = await services.assetModelService.getById(req.params.id);
      if (req.lendingLocationId && model.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetModel not found');
        err.status = 404;
        throw err;
      }
      await services.inventoryStockService.updateStock(
        model.id,
        model.lendingLocationId,
        {
          quantityTotal: req.body.quantityTotal,
          quantityAvailable: req.body.quantityAvailable,
          minThreshold: req.body.minThreshold,
          reorderThreshold: req.body.reorderThreshold,
        }
      );
      if (typeof req.flash === 'function') {
        req.flash('success', 'Bulk-Bestand gespeichert');
      }
      return res.redirect(`/admin/asset-models/${model.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = AssetModelAdminController;
