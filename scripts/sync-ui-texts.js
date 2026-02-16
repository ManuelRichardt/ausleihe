require('dotenv').config();

const path = require('path');
const models = require('../models');
const { createServices } = require('../services');

async function main() {
  const services = createServices(models);
  await models.sequelize.authenticate();
  const result = await services.uiTextService.syncAutoKeysFromViews({
    viewsRoot: path.join(process.cwd(), 'views'),
  });
  // eslint-disable-next-line no-console
  console.log(
    `UI texts sync complete: scanned=${result.scanned || 0}, created=${result.created || 0}, updated=${result.updated || 0}`
  );
}

main()
  .then(async () => {
    await models.sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err && err.message ? err.message : err);
    try {
      await models.sequelize.close();
    } catch (_) {
      // noop
    }
    process.exit(1);
  });
