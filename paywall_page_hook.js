// paywall_page_hook.js
// Runs in page context (not isolated extension context).
(function () {
  if (window.__popupBlockerPageHookInstalled) {
    return;
  }
  window.__popupBlockerPageHookInstalled = true;

  const BLOCK_PATTERNS = [
    "paywallbypassmemberdetailsquery",
    "memberandsubscriptionsdetailsquery",
    "query%20paywallrule",
    "query%20paywall",
    "paywallbypass(",
    "paywallbypassinput",
    "c2-au.piano.io/xbuilder/experience/execute",
    "buy-au.piano.io/api/v3/anon/template/loadtemplatecontext",
    "buy-au.piano.io/checkout/template/cacheableshow.html"
  ];

  const toNormalized = (url) => {
    try {
      return decodeURIComponent(String(url || "").toLowerCase());
    } catch {
      return String(url || "").toLowerCase();
    }
  };

  const shouldBlock = (url) => {
    const normalized = toNormalized(url);
    if (!normalized) {
      return false;
    }
    return BLOCK_PATTERNS.some((pattern) => normalized.includes(pattern));
  };

  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = function (...args) {
      const input = args[0];
      const url = typeof input === "string" ? input : input?.url;
      if (shouldBlock(url)) {
        return new Promise(() => {});
      }
      return originalFetch.apply(this, args);
    };
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__popupBlockerUrl = String(url || "");
    this.__popupBlockerShouldBlock = shouldBlock(this.__popupBlockerUrl);
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    if (this.__popupBlockerShouldBlock) {
      return;
    }
    return originalSend.apply(this, args);
  };
})();
