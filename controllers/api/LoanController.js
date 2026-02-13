const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./_controllerUtils');

const services = createServices();

const createReservation = handle((req) => services.loanService.createReservation(req.body), { idempotent: true });
const getById = handle((req) => services.loanService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.userId) {
    filter.userId = req.query.userId;
  }
  if (req.query.lendingLocationId) {
    filter.lendingLocationId = req.query.lendingLocationId;
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }
  return services.loanService.getAll(filter, parseListOptions(req));
});
const cancel = handle((req) => services.loanService.cancelLoan(req.params.id, req.body.userId, req.body.note), {
  idempotent: true,
  ifMatch: (req) => services.loanService.getById(req.params.id),
});
const handOver = handle((req) => services.loanService.handOverLoan(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.loanService.getById(req.params.id),
});
const returnLoan = handle((req) => services.loanService.returnLoan(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.loanService.getById(req.params.id),
});
const markOverdue = handle((req) => services.loanService.markOverdue(req.params.id), {
  idempotent: true,
  ifMatch: (req) => services.loanService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.loanService.deleteLoan(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.loanService.getById(req.params.id),
});

module.exports = {
  createReservation,
  getById,
  getAll,
  cancel,
  handOver,
  returnLoan,
  markOverdue,
  remove,
};
