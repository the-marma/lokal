const TZ_OFFSETS = {
  EDT: -4, EST: -5, ET: -5,
  PDT: -7, PST: -8, PT: -8,
  CDT: -5, CST: -6, CT: -6,
  MDT: -6, MST: -7, MT: -7,
  UTC: 0, GMT: 0,
  BST: 1, CET: 1, CEST: 2,
  IST: 5.5, JST: 9, KST: 9,
  AEST: 10, AEDT: 11, SGT: 8
};

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹', AUD: 'A$', CAD: 'C$', SGD: 'S$', CHF: 'Fr' };
const SYMBOL_TO_CODE = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR' };

let settings = {
  enabled: true,
  timezone: 'Asia/Kolkata',
  tzLabel: 'IST',
  currency: 'INR',
  dateFormat: 'DD/MM/YYYY',
  convertUnits: true,
  convertTemp: true
};

let rateCache = {};

async function init() {
  console.log('LocaleShift init');  
  const stored = await storageGet(['enabled','timezone','tzLabel','currency','dateFormat','convertUnits','convertTemp','rateCache']);
  Object.assign(settings, stored);
  if (stored.rateCache) rateCache = stored.rateCache;
  if (settings.enabled !== false) {
    await maybeRefreshRates();
    convertPage();
  }
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'apply-settings') {
    Object.assign(settings, msg);
    rateCache = {};
    revertPage();
    if (settings.enabled !== false) {
      maybeRefreshRates().then(convertPage);
    }
  }
});

init();

function storageGet(keys) {
  return new Promise(resolve => browser.storage.local.get(keys, resolve));
}

async function maybeRefreshRates() {
  if (!settings.currency) return;
  const cacheKey = `USD_${settings.currency}`;
  const age = rateCache.timestamp ? Date.now() - rateCache.timestamp : Infinity;
  if (rateCache[cacheKey] && age < 3600000) return;
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
    const data = await res.json();
    if (data.rates) {
      Object.keys(data.rates).forEach(code => {
        rateCache[`USD_${code}`] = data.rates[code];
      });
      rateCache.timestamp = Date.now();
      browser.storage.local.set({ rateCache });
    }
  } catch (e) {
    console.error('LocaleShift: rate fetch failed', e);
  }
}

function getRate(from, to) {
  if (from === to) return 1;
  const key = `${from}_${to}`;
  if (rateCache[key]) return rateCache[key];
  if (from === 'USD') return rateCache[`USD_${to}`] || null;
  if (to === 'USD') return rateCache[`USD_${from}`] ? 1 / rateCache[`USD_${from}`] : null;
  const toUSD = rateCache[`USD_${from}`] ? 1 / rateCache[`USD_${from}`] : null;
  const fromUSD = rateCache[`USD_${to}`] || null;
  return (toUSD && fromUSD) ? toUSD * fromUSD : null;
}

let domObserver = null;

function convertPage() {
  walkDOM(document.body);
  if (!domObserver) {
    domObserver = new MutationObserver(mutations => {
      for (const m of mutations)
        for (const n of m.addedNodes)
          if (n.nodeType === Node.ELEMENT_NODE) walkDOM(n);
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
  }
}

function revertPage() {
  document.querySelectorAll('[data-ls]').forEach(el => {
    el.replaceWith(document.createTextNode(el.getAttribute('data-ls')));
  });
}

function walkDOM(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const tag = n.parentElement?.tagName?.toLowerCase();
      if (['script','style','noscript','code','pre','input','textarea','select'].includes(tag)) return NodeFilter.FILTER_REJECT;
      if (n.parentElement?.closest('[data-ls]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(processTextNode);
}

function processTextNode(node) {
  let text = node.nodeValue;
  const original = text;

  if (settings.currency) text = convertCurrency(text);
  if (settings.convertTemp !== false) text = convertTemperature(text);
  if (settings.timezone) text = convertTimezone(text);
  if (settings.dateFormat) text = convertDate(text);
  if (settings.convertUnits !== false) text = convertUnits(text);

  if (text !== original) {
    const span = document.createElement('span');
    span.setAttribute('data-ls', original);
    span.textContent = text;
    node.parentNode?.replaceChild(span, node);
  }
}

const MULTIPLIERS = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };

function formatConverted(amount, to) {
  if (amount >= 1e7)  return `${(amount / 1e7).toFixed(2)} crore ${to}`;
  if (amount >= 1e5)  return `${(amount / 1e5).toFixed(2)} lakh ${to}`;
  if (amount >= 1000) return `${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ${to}`;
  return `${amount.toFixed(2)} ${to}`;
}

function convertCurrency(text) {
  const to = settings.currency;
  if (!to) return text;

  text = text.replace(/\b(USD|EUR|GBP|JPY|AUD|CAD|CHF|SGD)\s+([\d,]+(?:\.\d+)?)\s*(thousand|million|billion|trillion)?\b/gi,
    (match, fromCode, numStr, mult) => {
      const from = fromCode.toUpperCase();
      if (from === to) return match;
      const rate = getRate(from, to);
      if (!rate) return match;
      const base = parseFloat(numStr.replace(/,/g, ''));
      if (isNaN(base)) return match;
      const multiplier = mult ? (MULTIPLIERS[mult.toLowerCase()] || 1) : 1;
      const converted = base * multiplier * rate;
      return `${match} [${formatConverted(converted, to)}]`;
    }
  );

  text = text.replace(/([€£¥₹$])\s*([\d,]+(?:\.\d+)?)\s*(thousand|million|billion|trillion)?/g,
    (match, sym, numStr, mult) => {
      const from = SYMBOL_TO_CODE[sym];
      if (!from || from === to) return match;
      const rate = getRate(from, to);
      if (!rate) return match;
      const base = parseFloat(numStr.replace(/,/g, ''));
      if (isNaN(base)) return match;
      const multiplier = mult ? (MULTIPLIERS[mult.toLowerCase()] || 1) : 1;
      const converted = base * multiplier * rate;
      return `${match} [${formatConverted(converted, to)}]`;
    }
  );

  return text;
}

function convertTemperature(text) {
  text = text.replace(/(-?\d+(?:\.\d+)?)\s*°\s*F\b/g, (m, v) =>
    `${m} [${((parseFloat(v) - 32) * 5 / 9).toFixed(1)}°C]`);
  text = text.replace(/(-?\d+(?:\.\d+)?)\s*degrees?\s*F(?:ahrenheit)?\b/gi, (m, v) =>
    `${m} [${((parseFloat(v) - 32) * 5 / 9).toFixed(1)}°C]`);
  return text;
}

function convertTimezone(text) {
  const targetTZ = settings.timezone || 'Asia/Kolkata';
  const label = settings.tzLabel || 'IST';
  const tzPattern = Object.keys(TZ_OFFSETS).join('|');
  const re = new RegExp(`\\b(\\d{1,2})(?::(\\d{2}))?\\s*(AM|PM)\\s+(${tzPattern})\\b`, 'gi');

  return text.replace(re, (match, hStr, mStr, ampm, tz) => {
    let hour = parseInt(hStr);
    const min = parseInt(mStr || '0');
    const ap = ampm.toUpperCase();
    if (ap === 'PM' && hour !== 12) hour += 12;
    if (ap === 'AM' && hour === 12) hour = 0;
    const srcOffset = TZ_OFFSETS[tz.toUpperCase()];
    if (srcOffset === undefined) return match;
    const now = new Date();
    const utcMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), hour - srcOffset, min);
    try {
      const converted = new Intl.DateTimeFormat('en-US', {
        timeZone: targetTZ, hour: 'numeric', minute: '2-digit', hour12: true
      }).format(new Date(utcMs));
      return `${match} [${converted} ${label}]`;
    } catch (e) {
      return match;
    }
  });
}

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

function monthNum(name) {
  return String(MONTHS.indexOf(name.toLowerCase()) + 1).padStart(2, '0');
}

function applyDateFormat(d, m, y, fmt) {
  switch (fmt) {
    case 'DD/MM/YYYY': return `${d}/${m}/${y}`;
    case 'DD-MM-YYYY': return `${d}-${m}-${y}`;
    case 'YYYY-MM-DD': return `${y}-${m}-${d}`;
    case 'MM/DD/YYYY': return `${m}/${d}/${y}`;
    case 'MM-DD-YYYY': return `${m}-${d}-${y}`;
    default: return `${d}/${m}/${y}`;
  }
}

function convertDate(text) {
  const fmt = settings.dateFormat || 'DD/MM/YYYY';

  text = text.replace(/\b((?:19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g, (match, y, m, d) => {
    const result = applyDateFormat(d, m, y, fmt);
    return result === match ? match : `${result} [${match}]`;
  });

  text = text.replace(/\b(0?[1-9]|1[0-2])([\/-])(0?[1-9]|[12]\d|3[01])\2((?:19|20)\d{2})\b/g, (match, m, sep, d, y) => {
    if (fmt === 'MM/DD/YYYY' || fmt === 'MM-DD-YYYY') return match;
    const result = applyDateFormat(d.padStart(2,'0'), m.padStart(2,'0'), y, fmt);
    return result === match ? match : `${result} [${match}]`;
  });

  const monRe = MONTHS.map(m => m[0].toUpperCase() + m.slice(1)).join('|');
  text = text.replace(new RegExp(`\\b(${monRe})\\s+(\\d{1,2}),?\\s+((?:19|20)\\d{2})\\b`, 'g'), (match, mon, d, y) => {
    const result = applyDateFormat(d.padStart(2,'0'), monthNum(mon), y, fmt);
    return `${result} [${match}]`;
  });

  text = text.replace(new RegExp(`\\b(\\d{1,2})\\s+(${monRe}),?\\s+((?:19|20)\\d{2})\\b`, 'g'), (match, d, mon, y) => {
    const result = applyDateFormat(d.padStart(2,'0'), monthNum(mon), y, fmt);
    return `${result} [${match}]`;
  });

  return text;
}

function convertUnits(text) {
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*miles?\b/gi,             (m, v) => `${m} [${(v*1.60934).toFixed(1)} km]`);
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*mph\b/gi,                (m, v) => `${m} [${(v*1.60934).toFixed(0)} km/h]`);
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/gi,  (m, v) => `${m} [${(v*0.4536).toFixed(1)} kg]`);
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*fl\.?\s*oz\b/gi,        (m, v) => `${m} [${(v*29.574).toFixed(0)} ml]`);
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*oz\b/gi,                 (m, v) => `${m} [${(v*28.35).toFixed(0)} g]`);
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*(?:gallons?|gal)\b/gi,  (m, v) => `${m} [${(v*3.785).toFixed(1)} L]`);
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*(?:feet|foot)\b/gi,     (m, v) => `${m} [${(v*0.3048).toFixed(1)} m]`);
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*(?:inches?|in\.)\b/gi,  (m, v) => `${m} [${(v*2.54).toFixed(1)} cm]`);
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*acres?\b/gi,             (m, v) => `${m} [${(v*0.4047).toFixed(2)} ha]`);
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*(?:sq\s*ft|square\s*feet)\b/gi, (m, v) => `${m} [${(v*0.0929).toFixed(1)} m²]`);
  return text;
}