const buildGeneratedPaths = require('./paths.generated');

const SHARED_PATH_PARAMS = Object.freeze({
  id: Object.freeze({ name: 'id', schema: { type: 'string', format: 'uuid' } }),
  assetModelId: Object.freeze({
    name: 'assetModelId',
    schema: { type: 'string', format: 'uuid' },
  }),
  username: Object.freeze({ name: 'username', schema: { type: 'string' } }),
  key: Object.freeze({ name: 'key', schema: { type: 'string' } }),
  lendingLocationId: Object.freeze({
    name: 'lendingLocationId',
    schema: { type: 'string', format: 'uuid' },
  }),
  assetInstanceId: Object.freeze({
    name: 'assetInstanceId',
    schema: { type: 'string', format: 'uuid' },
  }),
  customFieldDefinitionId: Object.freeze({
    name: 'customFieldDefinitionId',
    schema: { type: 'string', format: 'uuid' },
  }),
});

const USER_PATH_KEYS = Object.freeze([
  '/users',
  '/users/search',
  `/users/username/{${SHARED_PATH_PARAMS.username.name}}`,
  `/users/{${SHARED_PATH_PARAMS.id.name}}`,
  `/users/{${SHARED_PATH_PARAMS.id.name}}/password`,
  `/users/{${SHARED_PATH_PARAMS.id.name}}/active`,
  `/users/{${SHARED_PATH_PARAMS.id.name}}/roles`,
]);

const RBAC_PATH_KEYS = Object.freeze([
  '/roles',
  '/roles/search',
  `/roles/{${SHARED_PATH_PARAMS.id.name}}`,
  `/roles/{${SHARED_PATH_PARAMS.id.name}}/permissions`,
  '/permissions',
  '/permissions/search',
  `/permissions/key/{${SHARED_PATH_PARAMS.key.name}}`,
  `/permissions/{${SHARED_PATH_PARAMS.id.name}}`,
  '/authz/check',
]);

const LENDING_LOCATION_PATH_KEYS = Object.freeze([
  '/lending-locations',
  `/lending-locations/{${SHARED_PATH_PARAMS.id.name}}`,
  `/lending-locations/{${SHARED_PATH_PARAMS.id.name}}/active`,
]);

const OPENING_HOURS_PATH_KEYS = Object.freeze([
  '/opening-hours/regular',
  `/opening-hours/regular/{${SHARED_PATH_PARAMS.lendingLocationId.name}}`,
  `/opening-hours/regular/{${SHARED_PATH_PARAMS.lendingLocationId.name}}/{dayOfWeek}`,
  '/opening-hours/exception',
  `/opening-hours/exception/{${SHARED_PATH_PARAMS.lendingLocationId.name}}`,
  `/opening-hours/exception/{${SHARED_PATH_PARAMS.lendingLocationId.name}}/{date}`,
  '/opening-exceptions',
  `/opening-exceptions/{${SHARED_PATH_PARAMS.id.name}}`,
]);

const INVENTORY_PATH_KEYS = Object.freeze([
  '/manufacturers',
  `/manufacturers/{${SHARED_PATH_PARAMS.id.name}}`,
  '/asset-categories',
  `/asset-categories/{${SHARED_PATH_PARAMS.id.name}}`,
  `/asset-categories/{${SHARED_PATH_PARAMS.id.name}}/active`,
  '/asset-models',
  `/asset-models/{${SHARED_PATH_PARAMS.id.name}}`,
  '/assets',
  '/assets/search',
  `/assets/{${SHARED_PATH_PARAMS.id.name}}`,
  `/assets/{${SHARED_PATH_PARAMS.id.name}}/storage-location`,
  `/assets/{${SHARED_PATH_PARAMS.id.name}}/condition`,
  `/assets/{${SHARED_PATH_PARAMS.id.name}}/active`,
  '/storage-locations',
  `/storage-locations/{${SHARED_PATH_PARAMS.id.name}}`,
  `/storage-locations/{${SHARED_PATH_PARAMS.id.name}}/active`,
  '/asset-attachments',
  `/asset-attachments/{${SHARED_PATH_PARAMS.id.name}}`,
  '/asset-maintenance',
  `/asset-maintenance/{${SHARED_PATH_PARAMS.id.name}}`,
  `/asset-maintenance/{${SHARED_PATH_PARAMS.id.name}}/complete`,
  '/custom-field-definitions',
  `/custom-field-definitions/{${SHARED_PATH_PARAMS.id.name}}`,
  `/custom-field-definitions/{${SHARED_PATH_PARAMS.id.name}}/deactivate`,
  `/custom-field-definitions/asset-model/{${SHARED_PATH_PARAMS.assetModelId.name}}`,
  `/custom-field-definitions/lending-location/{${SHARED_PATH_PARAMS.lendingLocationId.name}}`,
  `/custom-field-definitions/asset-instance/{${SHARED_PATH_PARAMS.assetInstanceId.name}}/resolve`,
  `/custom-field-values/{${SHARED_PATH_PARAMS.assetInstanceId.name}}`,
  `/custom-field-values/{${SHARED_PATH_PARAMS.assetInstanceId.name}}/{${SHARED_PATH_PARAMS.customFieldDefinitionId.name}}`,
]);

const LOAN_PATH_KEYS = Object.freeze([
  '/loans',
  `/loans/{${SHARED_PATH_PARAMS.id.name}}`,
  `/loans/{${SHARED_PATH_PARAMS.id.name}}/cancel`,
  `/loans/{${SHARED_PATH_PARAMS.id.name}}/hand-over`,
  `/loans/{${SHARED_PATH_PARAMS.id.name}}/return`,
  `/loans/{${SHARED_PATH_PARAMS.id.name}}/overdue`,
  '/loan-items',
  `/loan-items/{${SHARED_PATH_PARAMS.id.name}}`,
  `/loan-items/{${SHARED_PATH_PARAMS.id.name}}/remove-from-loan`,
  '/loan-signatures',
  `/loan-signatures/{${SHARED_PATH_PARAMS.id.name}}`,
  '/loan-events',
  `/loan-events/{${SHARED_PATH_PARAMS.id.name}}`,
  '/audit-logs',
  `/audit-logs/{${SHARED_PATH_PARAMS.id.name}}`,
]);

function selectPaths(pathMap, pathKeys) {
  return pathKeys.reduce((acc, key) => {
    if (pathMap[key]) {
      acc[key] = pathMap[key];
    }
    return acc;
  }, {});
}

function buildUserPaths(pathMap) {
  return selectPaths(pathMap, USER_PATH_KEYS);
}

function buildRbacPaths(pathMap) {
  return selectPaths(pathMap, RBAC_PATH_KEYS);
}

function buildLendingLocationPaths(pathMap) {
  return selectPaths(pathMap, LENDING_LOCATION_PATH_KEYS);
}

function buildOpeningHoursPaths(pathMap) {
  return selectPaths(pathMap, OPENING_HOURS_PATH_KEYS);
}

function buildInventoryPaths(pathMap) {
  return selectPaths(pathMap, INVENTORY_PATH_KEYS);
}

function buildLoanPaths(pathMap) {
  return selectPaths(pathMap, LOAN_PATH_KEYS);
}

module.exports = function buildPaths(builders) {
  const generatedPaths = buildGeneratedPaths(builders);

  // Path keys here must stay in sync with generated source and mounted route modules.
  return {
    ...buildUserPaths(generatedPaths),
    ...buildRbacPaths(generatedPaths),
    ...buildLendingLocationPaths(generatedPaths),
    ...buildOpeningHoursPaths(generatedPaths),
    ...buildInventoryPaths(generatedPaths),
    ...buildLoanPaths(generatedPaths),
  };
};
