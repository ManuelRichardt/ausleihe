module.exports = function requireLogin(req, res, next) {
  if (req.user) {
    return next();
  }
  const nextUrl = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(`/login?next=${nextUrl}`);
};
