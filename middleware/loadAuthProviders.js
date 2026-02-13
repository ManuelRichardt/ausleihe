const { createServices } = require('../services');

const services = createServices();

module.exports = async function loadAuthProviders(req, res, next) {
  try {
    const samlConfig = await services.configService.getAuthProvider('saml');
    const ldapConfig = await services.configService.getAuthProvider('ldap');
    res.locals.viewData = Object.assign({}, res.locals.viewData || {}, {
      samlEnabled: Boolean(samlConfig && samlConfig.enabled),
      samlDisplayName: samlConfig && samlConfig.displayName ? samlConfig.displayName : 'Shibboleth',
      ldapEnabled: Boolean(ldapConfig && ldapConfig.enabled),
      ldapDisplayName: ldapConfig && ldapConfig.displayName ? ldapConfig.displayName : 'LDAP',
      next: req.body.next || req.query.next || '',
    });
    return next();
  } catch (err) {
    return next(err);
  }
};
