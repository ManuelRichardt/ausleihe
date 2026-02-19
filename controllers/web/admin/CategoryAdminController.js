const {
  services,
  renderPage,
  handleError,
  parseListQuery,
  parseIncludeDeleted,
  buildPagination,
} = require('../controllerUtils');
const { toPublicUploadUrl, removePublicFileByUrl } = require('../../../utils/uploadImageHelper');

class CategoryAdminController {
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
      if (includeDeleted) {
        filter.includeDeleted = true;
      }

      const total = await services.assetCategoryService.countCategories(filter);
      const categories = await services.assetCategoryService.getAll(filter, { limit, offset, order });

      return renderPage(res, 'admin/categories/index', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Categories', href: '/admin/categories' },
        ],
        categories,
        filters: {
          q: req.query.q || '',
          status: req.query.status || '',
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
      const category = await services.assetCategoryService.getById(req.params.id);
      if (req.lendingLocationId && category.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetCategory not found');
        err.status = 404;
        throw err;
      }
      return renderPage(res, 'admin/categories/show', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Categories', href: '/admin/categories' },
          { label: category.name, href: `/admin/categories/${category.id}` },
        ],
        category,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async new(req, res, next) {
    try {
      return renderPage(res, 'admin/categories/new', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Categories', href: '/admin/categories' },
          { label: 'New', href: '/admin/categories/new' },
        ],
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async create(req, res, next) {
    try {
      const category = await services.assetCategoryService.createCategory({
        lendingLocationId: req.lendingLocationId,
        name: req.body.name,
        description: req.body.description,
        imageUrl: toPublicUploadUrl(req.file, 'categories'),
        isActive: req.body.isActive !== 'false',
      });
      if (typeof req.flash === 'function') {
        req.flash('success', 'Kategorie angelegt');
      }
      return res.redirect(`/admin/categories/${category.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async edit(req, res, next) {
    try {
      const category = res.locals.viewData && res.locals.viewData.category
        ? res.locals.viewData.category
        : await services.assetCategoryService.getById(req.params.id);
      if (req.lendingLocationId && category.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetCategory not found');
        err.status = 404;
        throw err;
      }
      return renderPage(res, 'admin/categories/edit', req, {
        breadcrumbs: [
          { label: 'Admin', href: '/admin/assets' },
          { label: 'Categories', href: '/admin/categories' },
          { label: category.name, href: `/admin/categories/${category.id}` },
          { label: 'Edit', href: `/admin/categories/${category.id}/edit` },
        ],
        category,
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async update(req, res, next) {
    try {
      const category = res.locals.viewData && res.locals.viewData.category
        ? res.locals.viewData.category
        : await services.assetCategoryService.getById(req.params.id);
      if (req.lendingLocationId && category.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetCategory not found');
        err.status = 404;
        throw err;
      }
      const removeImage = req.body.removeImage === '1' || req.body.removeImage === 'true';
      const nextImageUrl = toPublicUploadUrl(req.file, 'categories');
      const imageUrl = nextImageUrl || (removeImage ? null : category.imageUrl || null);
      await services.assetCategoryService.updateCategory(category.id, {
        name: req.body.name,
        description: req.body.description,
        imageUrl,
        isActive: req.body.isActive !== 'false',
      });
      if ((nextImageUrl || removeImage) && category.imageUrl && category.imageUrl !== imageUrl) {
        removePublicFileByUrl(category.imageUrl);
      }
      if (typeof req.flash === 'function') {
        req.flash('success', 'Kategorie gespeichert');
      }
      return res.redirect(`/admin/categories/${category.id}`);
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async remove(req, res, next) {
    try {
      const category = await services.assetCategoryService.getById(req.params.id);
      if (req.lendingLocationId && category.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetCategory not found');
        err.status = 404;
        throw err;
      }
      await services.assetCategoryService.deleteCategory(category.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Kategorie gelöscht');
      }
      return res.redirect('/admin/categories');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }

  async restore(req, res, next) {
    try {
      const includeDeleted = parseIncludeDeleted(req) || req.body.includeDeleted === '1';
      const category = await services.assetCategoryService.getById(req.params.id, { includeDeleted: true });
      if (req.lendingLocationId && category.lendingLocationId !== req.lendingLocationId) {
        const err = new Error('AssetCategory not found');
        err.status = 404;
        throw err;
      }
      await services.assetCategoryService.restoreCategory(category.id);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Kategorie wiederhergestellt');
      }
      return res.redirect(includeDeleted ? '/admin/categories?includeDeleted=1' : '/admin/categories');
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = CategoryAdminController;
