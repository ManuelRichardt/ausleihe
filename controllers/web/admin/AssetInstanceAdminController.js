const {
  services,
  renderPage,
  handleError,
  parseListQuery,
  parseIncludeDeleted,
  buildPagination,
} = require('../_controllerUtils');

class AssetInstanceAdminController {
  async index(req, res, next) {
    try {
      const { page, limit, offset, order, sortBy, sortOrder } = parseListQuery(
        req,
        ['inventoryNumber', 'serialNumber', 'createdAt', 'isActive'],
        { order: [['createdAt', 'DESC']] }
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
      if (req.query.assetModelId) {
        filter.assetModelId = req.query.assetModelId;
      }
      if (includeDeleted) {
        filter.includeDeleted = true;
      }

      const models = await services.assetModelService.getAll({ lendingLocationId: req.lendingLocationId, isActive: true });
      let assets = [];
      let total = 0;
      if (filter.query) {
        assets = await services.assetInstanceService.searchAssets(filter, { limit, offset, order });
        total = await services.assetInstanceService.countSearchAssets(filter);
      } else {
        assets = await services.assetInstanceService.getAll(filter, { limit, offset, order });
        total = await services.assetInstanceService.countAssets(filter);
      }

      return renderPage(res, 'admin/assets/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Assets', href: '/admin/assets' },
        ],
        assets,
        models,
        filters: {
          q: req.query.q || '',
          status: req.query.status || '',
          assetModelId: req.query.assetModelId || '',
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
      const asset = await services.assetInstanceService.getById(req.params.id);
      if (req.lendingLocationId && asset.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('Asset not found');
        err.status = 404;
        throw err;
      }
      return renderPage(res, 'admin/assets/show', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Assets', href: '/admin/assets' },
          { label: asset.inventoryNumber || asset.id, href: `/admin/assets/${asset.id}` },
        ],
        asset,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async new(req, res, next) {
    try {
      const models = res.locals.viewData && res.locals.viewData.models
        ? res.locals.viewData.models
        : await services.assetModelService.getAll({ lendingLocationId: req.lendingLocationId, isActive: true });
      return renderPage(res, 'admin/assets/new', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Assets', href: '/admin/assets' },
          { label: 'New', href: '/admin/assets/new' },
        ],
        models,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      const asset = await services.assetInstanceService.createAsset({
        lendingLocationId: req.lendingLocationId,
        assetModelId: req.body.assetModelId,
        inventoryNumber: req.body.inventoryNumber,
        serialNumber: req.body.serialNumber,
        condition: req.body.condition,
        isActive: req.body.isActive !== 'false',
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Asset angelegt');
      }
      return res.redirect(`/admin/assets/${asset.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const asset = res.locals.viewData && res.locals.viewData.asset
        ? res.locals.viewData.asset
        : await services.assetInstanceService.getById(req.params.id);
      if (req.lendingLocationId && asset.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('Asset not found');
        err.status = 404;
        throw err;
      }
      const models = res.locals.viewData && res.locals.viewData.models
        ? res.locals.viewData.models
        : await services.assetModelService.getAll({ lendingLocationId: req.lendingLocationId, isActive: true });
      return renderPage(res, 'admin/assets/edit', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Assets', href: '/admin/assets' },
          { label: asset.inventoryNumber || asset.id, href: `/admin/assets/${asset.id}` },
          { label: 'Edit', href: `/admin/assets/${asset.id}/edit` },
        ],
        asset,
        models,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async update(req, res, next) {
    try {
      const asset = res.locals.viewData && res.locals.viewData.asset
        ? res.locals.viewData.asset
        : await services.assetInstanceService.getById(req.params.id);
      if (req.lendingLocationId && asset.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('Asset not found');
        err.status = 404;
        throw err;
      }
      await services.assetInstanceService.updateAsset(asset.id, {
        assetModelId: req.body.assetModelId,
        inventoryNumber: req.body.inventoryNumber,
        serialNumber: req.body.serialNumber,
        condition: req.body.condition,
        isActive: req.body.isActive !== 'false',
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Asset gespeichert');
      }
      return res.redirect(`/admin/assets/${asset.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async remove(req, res, next) {
    try {
      const asset = await services.assetInstanceService.getById(req.params.id);
      if (req.lendingLocationId && asset.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('Asset not found');
        err.status = 404;
        throw err;
      }
      await services.assetInstanceService.deleteAsset(asset.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Asset gelöscht');
      }
      return res.redirect('/admin/assets');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async restore(req, res, next) {
    try {
      const includeDeleted = parseIncludeDeleted(req) || req.body.includeDeleted === '1';
      const asset = await services.assetInstanceService.getById(req.params.id, { includeDeleted: true });
      if (req.lendingLocationId && asset.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('Asset not found');
        err.status = 404;
        throw err;
      }
      await services.assetInstanceService.restoreAsset(asset.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Asset wiederhergestellt');
      }
      return res.redirect(includeDeleted ? '/admin/assets?includeDeleted=1' : '/admin/assets');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = AssetInstanceAdminController;
