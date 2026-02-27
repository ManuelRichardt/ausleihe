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
const defaultLocals = require('./middleware/defaultLocals');
const { csrfProtectionMiddleware } = require('./config/csrf');
const buildSessionConfig = require('./config/session');
const { createSessionStore } = require('./config/sessionStore');
const { createServices } = require('./services');

const webRouter = require('./routes/web');
const apiV1Router = require('./routes/api/v1');

const db = require('./models');

const app = express();
const services = createServices(db);
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '2mb';

function getPrivacyCleanupIntervalMs() {
  const raw = parseInt(process.env.PRIVACY_CLEANUP_INTERVAL_MINUTES || '60', 10);
  const minutes = Number.isNaN(raw) ? 60 : Math.max(raw, 5);
  return minutes * 60 * 1000;
}

function initializeAppLifecycle(runtimeServices) {
  const runtimeState = {
    lifecyclePhase: 'startup',
    privacyCleanupTimer: null,
    isPrivacyCleanupInFlight: false,
    arePrivacyCleanupHooksRegistered: false,
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const stopPrivacyCleanupJob = () => {
    if (!runtimeState.privacyCleanupTimer) {
      return;
    }
    clearInterval(runtimeState.privacyCleanupTimer);
    runtimeState.privacyCleanupTimer = null;
  };

  const waitForInFlightCleanup = async (timeoutMs = 10000) => {
    const startedAt = Date.now();
    while (runtimeState.isPrivacyCleanupInFlight && Date.now() - startedAt < timeoutMs) {
      await wait(100);
    }
  };

  const runCleanup = async () => {
    if (runtimeState.isPrivacyCleanupInFlight || runtimeState.lifecyclePhase === 'shutdown') {
      return;
    }
    runtimeState.isPrivacyCleanupInFlight = true;
    try {
      await runtimeServices.privacyService.runAutomaticCleanup();
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.error('Privacy cleanup failed:', err.message || err);
      }
    } finally {
      runtimeState.isPrivacyCleanupInFlight = false;
    }
  };

  const startPrivacyCleanupJob = () => {
    if (runtimeState.privacyCleanupTimer || process.env.NODE_ENV === 'test') {
      return;
    }
    runtimeState.lifecyclePhase = 'active';
    void runCleanup();
    runtimeState.privacyCleanupTimer = setInterval(runCleanup, getPrivacyCleanupIntervalMs());
    if (typeof runtimeState.privacyCleanupTimer.unref === 'function') {
      runtimeState.privacyCleanupTimer.unref();
    }
  };

  const shutdownLifecycle = async (signal) => {
    if (runtimeState.lifecyclePhase === 'shutdown') {
      return;
    }
    runtimeState.lifecyclePhase = 'shutdown';
    stopPrivacyCleanupJob();
    await waitForInFlightCleanup();
    if (signal && process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  };

  const registerShutdownHooks = () => {
    if (runtimeState.arePrivacyCleanupHooksRegistered) {
      return;
    }
    // Graceful shutdown waits for in-flight cleanup before process exit.
    const onSignal = (signal) => {
      void shutdownLifecycle(signal);
    };
    process.once('SIGTERM', () => onSignal('SIGTERM'));
    process.once('SIGINT', () => onSignal('SIGINT'));
    runtimeState.arePrivacyCleanupHooksRegistered = true;
  };

  return {
    startPrivacyCleanupJob,
    registerShutdownHooks,
  };
}

const appLifecycle = initializeAppLifecycle(services);
appLifecycle.registerShutdownHooks();

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
      }
    },
    referrerPolicy: { policy: 'no-referrer' },
  })
);
app.use(expressLayouts);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/html5-qrcode', express.static(path.join(__dirname, 'node_modules', 'html5-qrcode')));
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit, parameterLimit: 10000 }));
app.use(cookieParser());
const sessionStore = createSessionStore({ sessionModel: db.SessionRecord });
app.use(session(buildSessionConfig({ store: sessionStore })));
app.use(flash());
app.use(sanitize);
app.use(csrfProtectionMiddleware({ ignorePaths: ['/auth/saml/callback'] }));
app.use(defaultLocals);

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
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
    appLifecycle.startPrivacyCleanupJob();
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
    return res.render('errors/error403');
  }

  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(status);
  return res.render('error');
});

module.exports = app;
