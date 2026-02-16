const { createServices } = require('../services');
const path = require('path');

const services = createServices();
const VIEWS_ROOT = path.join(process.cwd(), 'views');

function translateMarkup(html, phrasePairs) {
  if (!html || !Array.isArray(phrasePairs) || !phrasePairs.length) {
    return html;
  }

  const protectedBlocks = [];
  let transformed = String(html);
  ['script', 'style', 'pre', 'code', 'textarea'].forEach((tagName) => {
    const pattern = new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, 'gi');
    transformed = transformed.replace(pattern, (match) => {
      const token = `__I18N_BLOCK_${protectedBlocks.length}__`;
      protectedBlocks.push(match);
      return token;
    });
  });

  phrasePairs.forEach((pair) => {
    const source = pair[0];
    const target = pair[1];
    if (!source || !target || source === target) {
      return;
    }
    transformed = transformed.split(source).join(target);
  });

  transformed = transformed.replace(/__I18N_BLOCK_(\d+)__/g, (full, index) => {
    const block = protectedBlocks[Number(index)];
    return block !== undefined ? block : full;
  });

  return transformed;
}

function normalizeLocale(value) {
  return String(value || '').toLowerCase() === 'en' ? 'en' : 'de';
}

module.exports = async function i18nMiddleware(req, res, next) {
  try {
    const queryLocale = req.query && req.query.lang ? req.query.lang : null;
    const cookieLocale = req.cookies && req.cookies.ui_lang ? req.cookies.ui_lang : null;
    const locale = normalizeLocale(queryLocale || cookieLocale || 'de');

    if (queryLocale && normalizeLocale(queryLocale) !== normalizeLocale(cookieLocale || '')) {
      res.cookie('ui_lang', locale, {
        httpOnly: true,
        sameSite: 'lax',
        secure: String(process.env.NODE_ENV || '').toLowerCase() === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 365,
      });
    }

    await services.uiTextService.syncAutoKeysFromViewsIfNeeded({ viewsRoot: VIEWS_ROOT });
    const [translations, phrasePairs] = await Promise.all([
      services.uiTextService.getMap(locale),
      services.uiTextService.getPhraseMap(locale),
    ]);
    const translator = function translate(key, fallback) {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey) {
        return fallback || '';
      }
      const translated = translations[normalizedKey];
      if (translated) {
        return translated;
      }
      if (fallback !== undefined && fallback !== null) {
        return fallback;
      }
      return normalizedKey;
    };

    const switchLanguageUrl = function withLanguage(targetLocale) {
      const nextLocale = normalizeLocale(targetLocale);
      const host = req.get('host') || 'localhost';
      const url = new URL(req.originalUrl || req.url || '/', `http://${host}`);
      url.searchParams.set('lang', nextLocale);
      return `${url.pathname}${url.search}`;
    };

    req.locale = locale;
    req.t = translator;
    res.locals.locale = locale;
    res.locals.t = translator;
    res.locals.switchLanguageUrl = switchLanguageUrl;

    const originalRender = res.render.bind(res);
    res.render = function patchedRender(view, options, callback) {
      let renderOptions = options;
      let cb = callback;
      if (typeof renderOptions === 'function') {
        cb = renderOptions;
        renderOptions = {};
      }
      const hasCallback = typeof cb === 'function';
      return originalRender(view, renderOptions, (err, html) => {
        if (err) {
          if (hasCallback) {
            return cb(err);
          }
          return next(err);
        }
        const localizedHtml = locale === 'en' ? translateMarkup(html, phrasePairs) : html;
        if (hasCallback) {
          return cb(null, localizedHtml);
        }
        return res.send(localizedHtml);
      });
    };

    return next();
  } catch (err) {
    req.locale = 'de';
    req.t = (key, fallback) => fallback || key;
    res.locals.locale = 'de';
    res.locals.t = (key, fallback) => fallback || key;
    res.locals.switchLanguageUrl = (locale) => {
      const next = normalizeLocale(locale);
      const rawUrl = req.originalUrl || req.url || '/';
      const delimiter = rawUrl.includes('?') ? '&' : '?';
      return `${rawUrl}${delimiter}lang=${next}`;
    };
    return next();
  }
};
