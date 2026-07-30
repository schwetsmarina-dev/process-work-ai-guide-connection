// Stale-build detector.
//
// Why this exists: a client (mobile browser especially) can keep running an
// old cached bundle long after we ship a new build. That's how a tester saw a
// raw "Сессия не найдена" screen that no longer exists in the code — her phone
// was running an outdated index.html/JS.
//
// How it works: Vite injects a content-hashed module script into index.html on
// every build (e.g. /assets/index-a1b2c3.js). That hash IS our version. We read
// the currently-running bundle's script src from the DOM, then periodically
// fetch a fresh copy of the server's index.html (cache-busted) and read ITS
// script src. If they differ, this tab is running a stale build → reload once.
//
// Reload is guarded so we never loop, and skipped while the user is inside a
// live session (typing) so no in-progress input is lost.

const RELOAD_GUARD_KEY = "pw_stale_reload_at";
// Never auto-reload more than once per this window, to avoid any reload loop
// (e.g. if the server briefly serves mismatched assets during a deploy).
const RELOAD_COOLDOWN_MS = 60 * 1000;

// The fingerprint of the bundle THIS tab is actually running. Captured once at
// module load, before any new build can change the DOM.
let currentFingerprint = readFingerprintFromDocument(document);

function readFingerprintFromDocument(doc) {
  try {
    const scripts = Array.from(doc.querySelectorAll('script[type="module"][src]'));
    // The app entry is the module script under /assets or /src. Join all module
    // src hashes so any changed chunk counts as a new version.
    const srcs = scripts
      .map((s) => s.getAttribute("src"))
      .filter(Boolean)
      .filter((src) => src.includes("/assets/") || src.includes("/src/"));
    return srcs.join("|") || null;
  } catch {
    return null;
  }
}

async function fetchServerFingerprint() {
  const res = await fetch(`/index.html?_=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return readFingerprintFromDocument(doc);
}

// Don't reload out from under someone actively typing in a session.
function isUserBusy() {
  const el = document.activeElement;
  if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
    if (el.value && el.value.trim().length > 0) return true;
  }
  return false;
}

function reloadIfAllowed() {
  if (isUserBusy()) return;
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY)) || 0;
  } catch {
    /* ignore */
  }
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return; // already reloaded recently
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  window.location.reload();
}

async function checkForNewVersion() {
  if (!currentFingerprint) return; // couldn't read our own version — do nothing
  let serverFingerprint;
  try {
    serverFingerprint = await fetchServerFingerprint();
  } catch {
    return; // offline / transient — try again next tick
  }
  if (!serverFingerprint) return;
  if (serverFingerprint !== currentFingerprint) {
    reloadIfAllowed();
  }
}

export function initVersionCheck() {
  // On initial load.
  checkForNewVersion();

  // When the tab comes back to the foreground (classic stale-mobile-tab case).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForNewVersion();
  });
  window.addEventListener("focus", checkForNewVersion);
}