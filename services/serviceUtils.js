function pickDefined(obj, keys) {
  const result = {};
  keys.forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
}

function applyIsActiveFilter(where, filter) {
  if (filter && filter.isActive !== undefined) {
    where.isActive = filter.isActive;
  }
}

function applyLendingLocationFilter(where, filter, required = false) {
  if (filter && filter.lendingLocationId) {
    where.lendingLocationId = filter.lendingLocationId;
    return;
  }
  if (required) {
    throw new Error('lendingLocationId is required');
  }
}

function buildListOptions(options = {}) {
  const listOptions = {};
  if (options.limit !== undefined) {
    listOptions.limit = options.limit;
  }
  if (options.offset !== undefined) {
    listOptions.offset = options.offset;
  }
  if (options.order) {
    listOptions.order = options.order;
  }
  if (options.paranoid === false) {
    listOptions.paranoid = false;
  }
  return listOptions;
}

function applyIncludeDeleted(listOptions, filter) {
  if (filter && filter.includeDeleted) {
    listOptions.paranoid = false;
  }
}

async function findByPkOrThrow(entityModel, id, message, options = {}) {
  // options passed through to findByPk
  const entity = await entityModel.findByPk(id, options);
  if (!entity) {
    throw new Error(message);
  }
  return entity;
}

module.exports = {
  pickDefined,
  applyIsActiveFilter,
  applyLendingLocationFilter,
  buildListOptions,
  applyIncludeDeleted,
  findByPkOrThrow,
};
