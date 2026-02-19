const { createServices } = require('../services');
const path = require('path');

const services = createServices();
const VIEWS_ROOT = path.join(process.cwd(), 'views');
const PROTECTED_TRANSLATION_TAGS = Object.freeze(['script', 'style', 'pre', 'code', 'textarea']);
const PROTECTED_TAG_PATTERNS = Object.freeze(
  PROTECTED_TRANSLATION_TAGS.map((tagName) => new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, 'gi'))
);
const FALLBACK_LOCALE = 'de';
const LOCALE_COOKIE_KEY = 'ui_lang';
const LOCALE_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 1000 * 60 * 60 * 24 * 365,
});
const PROTECTED_BLOCK_TOKEN_PREFIX = '__I18N_BLOCK_';
const PROTECTED_BLOCK_TOKEN_SUFFIX = '__';

function buildProtectedBlockToken(index) {
  // Token format must stay unique and impossible in normal HTML output.
  return `${PROTECTED_BLOCK_TOKEN_PREFIX}${index}${PROTECTED_BLOCK_TOKEN_SUFFIX}`;
}

function protectBlocks(html) {
  const protectedBlocks = [];
  let transformed = String(html);
  PROTECTED_TAG_PATTERNS.forEach((pattern) => {
    transformed = transformed.replace(pattern, (match) => {
      const token = buildProtectedBlockToken(protectedBlocks.length);
      protectedBlocks.push(match);
      return token;
    });
  });
  return { transformed, protectedBlocks };
}

function restoreBlocks(html, protectedBlocks) {
  const protectedBlockPattern = new RegExp(
    `${PROTECTED_BLOCK_TOKEN_PREFIX}(\\d+)${PROTECTED_BLOCK_TOKEN_SUFFIX}`,
    'g'
  );
  return html.replace(protectedBlockPattern, (full, index) => {
    const block = protectedBlocks[Number(index)];
    return block !== undefined ? block : full;
  });
}

function translateMarkup(html, phraseTranslations) {
  if (!html || !Array.isArray(phraseTranslations) || !phraseTranslations.length) {
    return html;
  }

  const protectedMarkup = protectBlocks(html);
  let transformed = protectedMarkup.transformed;

  // Phrase replacement is a fallback for legacy templates not yet migrated to explicit t(key) calls.
  phraseTranslations.forEach((pair) => {
    const source = pair[0];
    const target = pair[1];
    if (!source || !target || source === target) {
      return;
    }
    transformed = transformed.split(source).join(target);
  });

  return restoreBlocks(transformed, protectedMarkup.protectedBlocks);
}

function normalizeLocale(value) {
  return String(value || '').toLowerCase() === 'en' ? 'en' : FALLBACK_LOCALE;
}

function resolveLocale(req) {
  const queryLocale = req.query && req.query.lang ? req.query.lang : null;
  const cookieLocale = req.cookies && req.cookies[LOCALE_COOKIE_KEY] ? req.cookies[LOCALE_COOKIE_KEY] : null;
  return {
    locale: normalizeLocale(queryLocale || cookieLocale || FALLBACK_LOCALE),
    queryLocale,
    cookieLocale,
  };
}

function ensureLocaleCookie(res, locale, queryLocale, cookieLocale) {
  if (!queryLocale || normalizeLocale(queryLocale) === normalizeLocale(cookieLocale || '')) {
    return;
  }
  res.cookie(LOCALE_COOKIE_KEY, locale, {
    ...LOCALE_COOKIE_OPTIONS,
    secure: String(process.env.NODE_ENV || '').toLowerCase() === 'production',
  });
}

async function loadTranslations(locale) {
  // syncAutoKeysFromViewsIfNeeded is internally cached; repeated calls are no-ops unless source views changed.
  await services.uiTextService.syncAutoKeysFromViewsIfNeeded({ viewsRoot: VIEWS_ROOT });
  const [translations, phraseTranslations] = await Promise.all([
    services.uiTextService.getMap(locale),
    services.uiTextService.getPhraseMap(locale),
  ]);
  return { translations, phraseTranslations };
}

function buildTranslator(translations) {
  return function translate(key, fallback) {
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
}

function buildSwitchLanguageUrl(req) {
  return function withLanguage(targetLocale) {
    const nextLocale = normalizeLocale(targetLocale);
    const host = req.get('host') || 'localhost';
    const url = new URL(req.originalUrl || req.url || '/', `http://${host}`);
    url.searchParams.set('lang', nextLocale);
    return `${url.pathname}${url.search}`;
  };
}

function patchRender(res, next, locale, phraseTranslations) {
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
      const localizedHtml = locale === 'en' ? translateMarkup(html, phraseTranslations) : html;
      if (hasCallback) {
        return cb(null, localizedHtml);
      }
      return res.send(localizedHtml);
    });
  };
}

function applyFallbackLocalization(req, res) {
  req.locale = FALLBACK_LOCALE;
  req.t = (key, fallback) => fallback || key;
  res.locals.locale = FALLBACK_LOCALE;
  res.locals.t = (key, fallback) => fallback || key;
  res.locals.switchLanguageUrl = (locale) => {
    const next = normalizeLocale(locale);
    const rawUrl = req.originalUrl || req.url || '/';
    const delimiter = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${delimiter}lang=${next}`;
  };
}

module.exports = async function i18nMiddleware(req, res, next) {
  try {
    const { locale, queryLocale, cookieLocale } = resolveLocale(req);
    ensureLocaleCookie(res, locale, queryLocale, cookieLocale);
    const { translations, phraseTranslations } = await loadTranslations(locale);
    const translator = buildTranslator(translations);
    const switchLanguageUrl = buildSwitchLanguageUrl(req);

    req.locale = locale;
    req.t = translator;
    res.locals.locale = locale;
    res.locals.t = translator;
    res.locals.switchLanguageUrl = switchLanguageUrl;

    // Render patch is request-scoped and must be applied once per request.
    patchRender(res, next, locale, phraseTranslations);

    return next();
  } catch (err) {
    applyFallbackLocalization(req, res);
    return next();
  }
};
