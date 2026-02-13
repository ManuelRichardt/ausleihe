const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Zu viele Login-Versuche. Bitte später erneut versuchen.',
});

module.exports = {
  loginLimiter,
};
