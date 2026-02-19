const { createServices } = require('../../services');
const { parseListOptions, handle } = require('./controllerUtils');

const services = createServices();

const create = handle((req) => services.loanEventService.addEvent(req.body), { idempotent: true });
const getById = handle((req) => services.loanEventService.getById(req.params.id));
const getAll = handle((req) => {
  const filter = {};
  if (req.query.loanId) {
    filter.loanId = req.query.loanId;
  }
  if (req.query.userId) {
    filter.userId = req.query.userId;
  }
  if (req.query.type) {
    filter.type = req.query.type;
  }
  return services.loanEventService.getAll(filter, parseListOptions(req));
});
const update = handle((req) => services.loanEventService.updateEvent(req.params.id, req.body), {
  idempotent: true,
  ifMatch: (req) => services.loanEventService.getById(req.params.id),
});
const remove = handle(async (req) => {
  await services.loanEventService.deleteEvent(req.params.id);
}, {
  idempotent: true,
  ifMatch: (req) => services.loanEventService.getById(req.params.id),
});

module.exports = {
  create,
  getById,
  getAll,
  update,
  remove,
};
