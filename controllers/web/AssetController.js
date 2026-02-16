const { services, renderPage, handleError } = require('./_controllerUtils');
const path = require('path');

class AssetController {
  async index(req, res, next) {
    try {
      const viewMode = req.query.view === 'list' ? 'list' : 'grid';
      const sortBy = req.query.sortBy || 'name';
      const sortOrder = String(req.query.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      const filters = {
        q: req.query.q ? String(req.query.q) : '',
        categoryId: req.query.categoryId || '',
        manufacturerId: req.query.manufacturerId || '',
        lendingLocationId: req.query.lendingLocationId || '',
      };

      const listQuery = {
        query: filters.q || undefined,
        categoryId: filters.categoryId || undefined,
        manufacturerId: filters.manufacturerId || undefined,
        lendingLocationId: filters.lendingLocationId || undefined,
      };
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 6), 48);
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const offset = (page - 1) * limit;

      const order = this.buildSortOrder(sortBy, sortOrder);
      const total = await services.assetModelService.countAssetModels(listQuery);
      const assetModels = await services.assetModelService.getAll(listQuery, { limit, offset, order });

      const manufacturers = await services.manufacturerService.getAll({
        isActive: true,
        lendingLocationId: filters.lendingLocationId || undefined,
      });
      const categories = await services.assetCategoryService.getAll({
        isActive: true,
        lendingLocationId: filters.lendingLocationId || undefined,
      });

      return renderPage(res, 'assets/index', req, {
        breadcrumbs: [{ label: 'Assets', href: '/assets' }],
        assetModels,
        manufacturers,
        categories,
        filters,
        viewMode,
        sortBy,
        sortOrder,
        pagination: {
          page,
          limit,
          total,
          hasNext: page * limit < total,
        },
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async show(req, res, next) {
    try {
      const assetModel = await services.assetModelService.getById(req.params.id);
      const customFieldDefinitions = await services.customFieldDefinitionService.getAll({
        scope: 'global',
        isActive: true,
      });
      const trackingType = assetModel.trackingType || 'serialized';
      const bundleDefinition = trackingType === 'bundle'
        ? await services.bundleService.getByAssetModel(assetModel.id, assetModel.lendingLocationId)
        : null;
      const bundleAvailability = bundleDefinition
        ? await services.bundleService.computeBundleAvailability(
          bundleDefinition.id,
          assetModel.lendingLocationId,
          { reservedFrom: new Date(), reservedUntil: new Date(Date.now() + (24 * 60 * 60 * 1000)) }
        )
        : null;
      const stock = trackingType === 'bulk'
        ? await services.inventoryStockService.getStock(assetModel.id, assetModel.lendingLocationId)
        : null;

      return renderPage(res, 'assets/show', req, {
        breadcrumbs: [
          { label: 'Assets', href: '/assets' },
          { label: assetModel.name || 'Asset', href: `/assets/${req.params.id}` },
        ],
        assetModel,
        customFieldDefinitions,
        bundleDefinition,
        bundleAvailability,
        stock,
      });
    } catch (err) {
      if (err && err.message && err.message.toLowerCase().includes('not found')) {
        err.status = 404;
      }
      return handleError(res, next, req, err);
    }
  }

  async reserve(req, res, next) {
    try {
      const assetModel = await services.assetModelService.getById(req.params.id);
      const trackingType = assetModel.trackingType || 'serialized';
      const bundleDefinition = trackingType === 'bundle'
        ? await services.bundleService.getByAssetModel(assetModel.id, assetModel.lendingLocationId)
        : null;
      const stock = trackingType === 'bulk'
        ? await services.inventoryStockService.getStock(assetModel.id, assetModel.lendingLocationId)
        : null;
      return renderPage(res, 'assets/reserve', req, {
        breadcrumbs: [
          { label: 'Assets', href: '/assets' },
          { label: assetModel.name || 'Asset', href: `/assets/${assetModel.id}` },
          { label: 'Reservieren', href: `/assets/${assetModel.id}/reserve` },
        ],
        assetModel,
        trackingType,
        bundleDefinition,
        stock,
        dailyAvailability: await services.availabilityService.getDailyAvailability(assetModel.id, new Date(), 90),
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async downloadAttachment(req, res, next) {
    try {
      const assetModel = await services.assetModelService.getById(req.params.id);
      const attachments = Array.isArray(assetModel.attachments) ? assetModel.attachments : [];
      const attachment = attachments.find((item) => item.id === req.params.attachmentId);
      if (!attachment || !attachment.url) {
        const err = new Error('Attachment not found');
        err.status = 404;
        throw err;
      }

      const rawUrl = String(attachment.url);
      if (/^https?:\/\//i.test(rawUrl)) {
        return res.redirect(rawUrl);
      }

      const normalizedUrl = rawUrl.replace(/^\/?public\//, '/');
      const relativePath = normalizedUrl.startsWith('/') ? normalizedUrl.slice(1) : normalizedUrl;
      const filePath = path.join(process.cwd(), 'public', relativePath);
      const safeBase = path.join(process.cwd(), 'public');
      if (!filePath.startsWith(safeBase)) {
        const err = new Error('Attachment path is invalid');
        err.status = 400;
        throw err;
      }

      const ext = path.extname(filePath);
      const filename = attachment.title
        ? `${attachment.title}${ext && !attachment.title.endsWith(ext) ? ext : ''}`
        : path.basename(filePath);
      return res.download(filePath, filename);
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        err.status = 404;
      }
      return handleError(res, next, req, err);
    }
  }

  buildSortOrder(sortBy, sortOrder) {
    const order = [];
    switch (sortBy) {
      case 'manufacturer':
        order.push([{ model: services.models.Manufacturer, as: 'manufacturer' }, 'name', sortOrder]);
        break;
      case 'category':
        order.push([{ model: services.models.AssetCategory, as: 'category' }, 'name', sortOrder]);
        break;
      case 'inventoryNumber':
        order.push(['name', sortOrder]);
        break;
      case 'name':
      default:
        order.push(['name', sortOrder]);
        break;
    }
    return order;
  }
}

module.exports = AssetController;
