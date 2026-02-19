const helpers = require('../routes/api/v1/openapi/helpers');
const buildGeneratedPaths = require('../routes/api/v1/openapi/paths.generated');
const buildGroupedPaths = require('../routes/api/v1/openapi/paths.builder');

function comparePathSets() {
  const generatedKeys = Object.keys(buildGeneratedPaths(helpers)).sort();
  const groupedKeys = Object.keys(buildGroupedPaths(helpers)).sort();
  const missingFromGrouped = generatedKeys.filter((key) => !groupedKeys.includes(key));
  const missingFromGenerated = groupedKeys.filter((key) => !generatedKeys.includes(key));
  return {
    generatedKeys,
    groupedKeys,
    missingFromGrouped,
    missingFromGenerated,
  };
}

function run() {
  const result = comparePathSets();
  if (result.missingFromGrouped.length || result.missingFromGenerated.length) {
    // eslint-disable-next-line no-console
    console.error('OpenAPI generated path drift detected.');
    // eslint-disable-next-line no-console
    console.error('Missing from grouped:', result.missingFromGrouped);
    // eslint-disable-next-line no-console
    console.error('Missing from generated:', result.missingFromGenerated);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`OpenAPI generated path check passed (${result.generatedKeys.length} paths).`);
}

run();
