const { createServices } = require('../services');
const models = require('../models');

const services = createServices();

async function resolveLoanScope(req, res, next) {
  try {
    const loanId = req.params.id;
    if (!loanId) {
      return next();
    }
    const loan = await models.Loan.findByPk(loanId, {
      attributes: ['id', 'lendingLocationId'],
    });
    if (!loan) {
      return next();
    }
    if (loan && loan.lendingLocationId) {
      req.loanScopeLendingLocationId = loan.lendingLocationId;
      req.lendingLocationId = loan.lendingLocationId;
      res.locals.loanScopeLendingLocationId = loan.lendingLocationId;
      res.locals.lendingLocationId = loan.lendingLocationId;
    }
    return next();
  } catch (err) {
    return next();
  }
}

module.exports = resolveLoanScope;
