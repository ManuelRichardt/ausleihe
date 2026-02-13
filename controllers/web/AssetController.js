const { services, renderPage, handleError } = require('./_controllerUtils');

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
      };

      const listQuery = {
        query: filters.q || undefined,
        categoryId: filters.categoryId || undefined,
        manufacturerId: filters.manufacturerId || undefined,
      };
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 6), 48);
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const offset = (page - 1) * limit;

      const order = this.buildSortOrder(sortBy, sortOrder);
      const total = await services.assetModelService.countAssetModels(listQuery);
      const assetModels = await services.assetModelService.getAll(listQuery, { limit, offset, order });

      const manufacturers = await services.manufacturerService.getAll({ isActive: true });
      const categories = await services.assetCategoryService.getAll({ isActive: true });

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
      const definitions = await services.customFieldDefinitionService.getAll({ isActive: true });
      const customFieldDefinitions = (definitions || []).filter((definition) => {
        const value = definition && definition.defaultValue !== undefined && definition.defaultValue !== null
          ? String(definition.defaultValue).trim()
          : '';
        return value.length > 0;
      });

      return renderPage(res, 'assets/show', req, {
        breadcrumbs: [
          { label: 'Assets', href: '/assets' },
          { label: assetModel.name || 'Asset', href: `/assets/${req.params.id}` },
        ],
        assetModel,
        customFieldDefinitions,
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
      return renderPage(res, 'assets/reserve', req, {
        breadcrumbs: [
          { label: 'Assets', href: '/assets' },
          { label: assetModel.name || 'Asset', href: `/assets/${assetModel.id}` },
          { label: 'Reservieren', href: `/assets/${assetModel.id}/reserve` },
        ],
        assetModel,
        dailyAvailability: await services.availabilityService.getDailyAvailability(assetModel.id, new Date(), 90),
      });
    } catch (err) {
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
