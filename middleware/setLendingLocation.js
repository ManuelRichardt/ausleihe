module.exports = function setLendingLocation(req, res, next) {
  if (!req.body.lendingLocationId && req.lendingLocationId) {
    req.body.lendingLocationId = req.lendingLocationId;
  }
  next();
};
