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
    "buy-au.piano.io/checkout/template/cacheableshow.html",
    "chartbeat.net/ping/conversion_event",
    "cec=paywall"
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

  const patchPaywallState = (value) => {
    if (!value || typeof value !== "object") {
      return false;
    }

    const seen = new WeakSet();
    const stack = [value];
    let changed = false;

    while (stack.length) {
      const current = stack.pop();
      if (!current || typeof current !== "object" || seen.has(current)) {
        continue;
      }

      seen.add(current);

      if (Object.prototype.hasOwnProperty.call(current, "hasPaywallAccess") && current.hasPaywallAccess === false) {
        current.hasPaywallAccess = true;
        changed = true;
      }

      if (Object.prototype.hasOwnProperty.call(current, "hasMeter") && current.hasMeter === true) {
        current.hasMeter = false;
        changed = true;
      }

      if (Object.prototype.hasOwnProperty.call(current, "preview") && current.preview === true) {
        current.preview = false;
        changed = true;
      }

      for (const child of Object.values(current)) {
        if (child && typeof child === "object") {
          stack.push(child);
        }
      }
    }

    return changed;
  };

  const patchNextDataScript = (script) => {
    if (!script || script.__popupBlockerPatched || script.id !== "__NEXT_DATA__") {
      return false;
    }

    const raw = script.textContent;
    if (!raw) {
      return false;
    }

    try {
      const data = JSON.parse(raw);
      const changed = patchPaywallState(data);
      script.__popupBlockerPatched = true;
      if (changed) {
        script.textContent = JSON.stringify(data);
      }
      return changed;
    } catch {
      return false;
    }
  };

  const patchExistingNextData = () => {
    patchNextDataScript(document.getElementById("__NEXT_DATA__"));
  };

  const installNextDataWatcher = () => {
    patchExistingNextData();

    try {
      let nextDataValue = window.__NEXT_DATA__;
      patchPaywallState(nextDataValue);

      Object.defineProperty(window, "__NEXT_DATA__", {
        configurable: true,
        get() {
          return nextDataValue;
        },
        set(value) {
          patchPaywallState(value);
          nextDataValue = value;
        }
      });
    } catch {
      patchPaywallState(window.__NEXT_DATA__);
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node?.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }

          if (node.id === "__NEXT_DATA__") {
            patchNextDataScript(node);
            continue;
          }

          if (typeof node.querySelector === "function") {
            patchNextDataScript(node.querySelector("#__NEXT_DATA__"));
          }
        }
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", patchExistingNextData, { once: true });
    }
  };

  installNextDataWatcher();

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
