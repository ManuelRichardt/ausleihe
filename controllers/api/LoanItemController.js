const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./controllerUtils');

const services = createServices();

const create = handle(
  (req) =>
    services.loanItemService.addItemToLoan(
      req.body.loanId,
      req.body.assetId,
      req.body.conditionOnHandover
    ),
  { idempotent: true }
);
const removeFromLoan = handle(async (req) => {
  await services.loanItemService.removeItemFromLoan(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.loanItemService.getById(req.params.id),
});
const getById = handle((req) => services.loanItemService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.loanId) {
    filter.loanId = req.query.loanId;
  }
  if (req.query.assetId) {
    filter.assetId = req.query.assetId;
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }
  return services.loanItemService.getAll(filter, parseListOptions(req));
});
const update = handle((req) => services.loanItemService.updateLoanItem(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.loanItemService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.loanItemService.deleteLoanItem(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.loanItemService.getById(req.params.id),
});

module.exports = {
  create,
  removeFromLoan,
  getById,
  getAll,
  update,
  remove,
};
