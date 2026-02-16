const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const session = require('express-session');
const flash = require('connect-flash');
const sanitize = require('./middleware/sanitize');
const { csrfProtectionMiddleware } = require('./config/csrf');
const buildSessionConfig = require('./config/session');

const webRouter = require('./routes/web');
const apiV1Router = require('./routes/api/v1');

const db = require('./models');

const app = express();

app.set('trust proxy', 1);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layout/main');

app.use(logger('dev'));
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 15552000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'no-referrer' },
  })
);
app.use(expressLayouts);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session(buildSessionConfig()));
app.use(flash());
app.use(sanitize);
app.use(csrfProtectionMiddleware({ ignorePaths: ['/auth/saml/callback'] }));
app.use((req, res, next) => {
  const formatTimeHHMM = (value) => {
    if (value === undefined || value === null || value === '') {
      return '';
    }
    if (value instanceof Date) {
      const hh = String(value.getHours()).padStart(2, '0');
      const mm = String(value.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
    const text = String(value).trim();
    const hhmmMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (hhmmMatch) {
      const hh = String(Number(hhmmMatch[1])).padStart(2, '0');
      return `${hh}:${hhmmMatch[2]}`;
    }
    if (text.includes('T')) {
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime())) {
        const hh = String(parsed.getHours()).padStart(2, '0');
        const mm = String(parsed.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      }
    }
    return text;
  };

  res.locals.user = res.locals.user || null;
  res.locals.permissions = res.locals.permissions || { list: [], map: {} };
  res.locals.breadcrumbs = res.locals.breadcrumbs || [];
  res.locals.flashMessages = res.locals.flashMessages || {};
  res.locals.lendingLocation = res.locals.lendingLocation || null;
  res.locals.csrfToken = res.locals.csrfToken || '';
  res.locals.formData = res.locals.formData || {};
  res.locals.errors = res.locals.errors || {};
  res.locals.pageTitle = res.locals.pageTitle || 'Ausleihsystem';
  res.locals.navigation = res.locals.navigation || [];
  res.locals.currentUser = res.locals.currentUser || res.locals.user || null;
  res.locals.activeLendingLocation = res.locals.activeLendingLocation || res.locals.lendingLocation || null;
  res.locals.can = res.locals.can || (() => false);
  res.locals.canAny = res.locals.canAny || (() => false);
  res.locals.canAll = res.locals.canAll || (() => false);
  res.locals.formatTimeHHMM = res.locals.formatTimeHHMM || formatTimeHHMM;
  next();
});

app.use('/', webRouter);
app.use('/api/v1', apiV1Router);

// Initialize database connection without blocking server startup
(async () => {
  try {
    await db.sequelize.authenticate();
    if (process.env.DB_SYNC === 'true') {
      await db.sequelize.sync();
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.error('Unable to connect to the database:', err.message || err);
    }
  }
})();

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (req.path.startsWith('/api/v1')) {
    res.status(status).json({
      data: null,
      error: {
        message: err.message || 'Internal Server Error',
        code: err.code || String(status),
      },
    });
    return;
  }

  if (status === 403) {
    res.status(403);
    return res.render('errors/403');
  }

  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(status);
  return res.render('error');
});

module.exports = app;
