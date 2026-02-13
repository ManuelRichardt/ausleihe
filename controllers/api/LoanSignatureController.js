const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./_controllerUtils');

const services = createServices();

const create = handle((req) => services.loanSignatureService.addSignature(req.body), { idempotent: true });
const getById = handle((req) => services.loanSignatureService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.loanId) {
    filter.loanId = req.query.loanId;
  }
  if (req.query.userId) {
    filter.userId = req.query.userId;
  }
  if (req.query.signatureType) {
    filter.signatureType = req.query.signatureType;
  }
  return services.loanSignatureService.getAll(filter, parseListOptions(req));
});
const update = handle((req) => services.loanSignatureService.updateSignature(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.loanSignatureService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.loanSignatureService.deleteSignature(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.loanSignatureService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  getAll,
  update,
  remove,
};
