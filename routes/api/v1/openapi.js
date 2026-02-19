const { apiBase, openapiVersion, tags } = require('./openapi/constants');
// This module should only orchestrate calls; business rules belong in services.
const buildComponents = require('./openapi/components');
const buildPaths = require('./openapi/pathsBuilder');
const helpers = require('./openapi/helpers');

module.exports = {
  openapi: openapiVersion,
  info: {
    title: 'Inventory Loan API',
    version: '1.0.0',
    description: 'API for device and room lending system',
  },
  servers: [{ url: apiBase }],
  tags,
  components: buildComponents({
    ErrorResponse: helpers.ErrorResponse,
  }),
  paths: buildPaths(helpers),
};
