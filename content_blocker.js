// content_blocker.js

const PAYWALL_SELECTORS = [
  '#paywall-prompt-wrapper-piano-id',
  '#paywall-prompt-piano-id',
  '#soft-reg-wall-piano-id',
  '#hard-reg-wall-piano-id',
  '#meter-prompt-piano-id',
  '#eoa-meter-prompt-piano-id',
  '#meter-toaster-piano-id',
  '#app-prompt-piano-id',
  '#app-collapsible-prompt-piano-id',
  '[id*="paywall-prompt"]',
  '[id*="meter-prompt"]',
  '[id*="soft-reg-wall"]',
  '[id*="hard-reg-wall"]',
  '[class*="paywall-prompt"]',
  '[class*="soft-reg-wall"]',
  '[class*="hard-reg-wall"]',
  '[class*="meter-toaster"]',
  '[data-testid*="paywall"]',
  '[aria-label*="subscribe" i]'
].join(", ");

const BOOTSTRAP_SCRIPT_PATTERNS = [
  "cdn.tinypass.com/api/tinypass.min.js",
  "tinypass",
  "tp.piano",
  "/piano/",
  "experience.piano"
];

const PAYWALL_REQUEST_PATTERNS = [
  "paywallbypassmemberdetailsquery",
  "memberandsubscriptionsdetailsquery",
  "paywallbypass(",
  "paywallbypassinput",
  "graphql?query=query%20paywall",
  "graphql?query=query%20memberandsubscriptions"
];

function ensureBypassStyle() {
  if (document.getElementById("popup-blocker-bypass-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "popup-blocker-bypass-style";
  style.textContent = `
    html.popup-blocker-unlock,
    body.popup-blocker-unlock {
      overflow: auto !important;
      overflow-y: auto !important;
      position: static !important;
      height: auto !important;
    }
    ${PAYWALL_SELECTORS} {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      max-height: 0 !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

function unlockPageScroll() {
  if (document.documentElement) {
    document.documentElement.classList.add("popup-blocker-unlock");
    document.documentElement.style.setProperty("overflow", "auto", "important");
    document.documentElement.style.setProperty("overflow-y", "auto", "important");
  }
  if (document.body) {
    document.body.classList.add("popup-blocker-unlock");
    document.body.style.setProperty("overflow", "auto", "important");
    document.body.style.setProperty("overflow-y", "auto", "important");
    document.body.style.setProperty("position", "static", "important");
  }
}

function neutralizePaywallElements() {
  const candidates = document.querySelectorAll(PAYWALL_SELECTORS);
  candidates.forEach((el) => {
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("opacity", "0", "important");
    el.style.setProperty("pointer-events", "none", "important");
    el.style.setProperty("max-height", "0", "important");
  });
}

function hasContentShell() {
  return Boolean(document.body && (document.querySelector("article") || document.querySelector("main")));
}

function hasBootstrapScriptInDom() {
  const scripts = document.querySelectorAll("script[src]");
  for (const script of scripts) {
    const src = (script.getAttribute("src") || "").toLowerCase();
    if (BOOTSTRAP_SCRIPT_PATTERNS.some((pattern) => src.includes(pattern))) {
      return true;
    }
  }
  return false;
}

function hasPaywallSignal() {
  if (hasBootstrapScriptInDom()) {
    return true;
  }
  return Boolean(document.querySelector(PAYWALL_SELECTORS));
}

function isBootstrapScriptNode(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE || node.tagName !== "SCRIPT") {
    return false;
  }
  const src = (node.getAttribute("src") || "").toLowerCase();
  if (!src) {
    return false;
  }
  return BOOTSTRAP_SCRIPT_PATTERNS.some((pattern) => src.includes(pattern));
}

function normalizeUrlForMatch(url) {
  try {
    return decodeURIComponent(String(url || "").toLowerCase());
  } catch {
    return String(url || "").toLowerCase();
  }
}

function shouldBlockPaywallRequest(url) {
  const normalized = normalizeUrlForMatch(url);
  if (!normalized) {
    return false;
  }
  return PAYWALL_REQUEST_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function installRequestBlockers(currentOrigin) {
  if (window.__popupBlockerRequestHooksInstalled) {
    return;
  }
  window.__popupBlockerRequestHooksInstalled = true;

  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = function (...args) {
      const request = args[0];
      const url = typeof request === "string" ? request : request?.url;
      if (shouldBlockPaywallRequest(url)) {
        console.log(`[Popup Blocker] Blocked paywall fetch for ${currentOrigin}: ${url}`);
        // Keep the caller waiting to avoid triggering fallback paywall routes.
        return new Promise(() => {});
      }
      return originalFetch.apply(this, args);
    };
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__popupBlockerUrl = String(url || "");
    this.__popupBlockerShouldBlock = shouldBlockPaywallRequest(this.__popupBlockerUrl);
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    if (this.__popupBlockerShouldBlock) {
      console.log(`[Popup Blocker] Blocked paywall XHR for ${currentOrigin}: ${this.__popupBlockerUrl}`);
      // Intentionally do not send this request.
      return;
    }
    return originalSend.apply(this, args);
  };
}

function injectPageWorldRequestBlockers() {
  if (window.__popupBlockerPageScriptInjected) {
    return;
  }
  window.__popupBlockerPageScriptInjected = true;

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("paywall_page_hook.js");
  script.async = false;
  script.onload = () => script.remove();
  (document.documentElement || document.head || document.body).appendChild(script);
}

function stopNearPaywallBootstrap(currentOrigin) {
  const maxWaitMs = 5000;
  const startedAt = Date.now();
  let didStop = false;
  let sawBootstrapScript = false;
  let observerTimer = null;

  const stopNow = (reason) => {
    if (didStop) {
      return;
    }
    didStop = true;
    console.log(`[Popup Blocker] Paywall stop triggered for ${currentOrigin} (${reason})`);
    window.stop();
  };

  const maybeStop = (reason) => {
    // Prefer stopping close to paywall bootstrap to avoid both white pages and late 404 overlays.
    if (sawBootstrapScript && hasContentShell()) {
      stopNow(reason);
      return true;
    }

    if (Date.now() - startedAt >= maxWaitMs && hasPaywallSignal() && hasContentShell()) {
      stopNow("paywall-signal-timeout-fallback");
      return true;
    }

    return false;
  };

  if (hasBootstrapScriptInDom()) {
    sawBootstrapScript = true;
    if (maybeStop("bootstrap-script-present-initial")) {
      return;
    }
  }

  const signalObserver = new MutationObserver((mutations) => {
    if (didStop) {
      return;
    }

    if (observerTimer) {
      return;
    }

    observerTimer = setTimeout(() => {
      observerTimer = null;
      if (!didStop && hasPaywallSignal()) {
        maybeStop("paywall-signal-observed");
      }
    }, 80);

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (isBootstrapScriptNode(node)) {
          sawBootstrapScript = true;
          maybeStop("bootstrap-script-added");
          return;
        }
      }
    }
  });

  const observeTarget = document.documentElement || document;
  signalObserver.observe(observeTarget, { childList: true, subtree: true });

  const tick = () => {
    if (didStop) {
      signalObserver.disconnect();
      return;
    }

    if (maybeStop("poll")) {
      signalObserver.disconnect();
      return;
    }

    if (Date.now() - startedAt >= maxWaitMs + 500) {
      signalObserver.disconnect();
      return;
    }

    setTimeout(tick, 60);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (!didStop && hasPaywallSignal()) {
        maybeStop("dom-content-loaded");
      }
    }, { once: true });
  }

  tick();
}

function startBlockedSiteHandling(currentOrigin) {
  injectPageWorldRequestBlockers();
  installRequestBlockers(currentOrigin);
  ensureBypassStyle();
  unlockPageScroll();
  neutralizePaywallElements();

  // Keep neutralizing late-injected overlays without triggering mutation feedback loops.
  let timer = null;
  const stopObservingAfterMs = 15000;
  const observer = new MutationObserver(() => {
    if (timer) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      unlockPageScroll();
      neutralizePaywallElements();
    }, 80);
  });

  const observerTarget = document.documentElement || document;
  observer.observe(observerTarget, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), stopObservingAfterMs);

  stopNearPaywallBootstrap(currentOrigin);
}

chrome.storage.sync.get({ blockedSites: [] }, (data) => {
  const blockedSites = data.blockedSites;
  const currentOrigin = window.location.origin;

  if (blockedSites.includes(currentOrigin)) {
    startBlockedSiteHandling(currentOrigin);
  }
});