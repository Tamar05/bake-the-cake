// Detects the app's install/runtime environment so <InstallGate> can decide
// whether to show the real app (it's running as an installed PWA) or an
// "install me first" screen, and give the right per-platform instructions.
//
// The tricky real-world cases this handles:
//  - a link tapped inside WhatsApp/Instagram/etc. opens an *in-app* browser
//    where install usually isn't offered → tell them to open a real browser;
//  - on iPhone, Add-to-Home-Screen only works in Safari, not Chrome/Firefox →
//    tell them to switch to Safari.
//
// The functions are kept pure (they take the user-agent string / flags as
// inputs) so they unit-test without a real browser; getInstallEnv(window) is
// the thin wrapper that reads them off the live `window`.

export type Platform = 'ios' | 'android' | 'desktop';

export type InstallEnv = {
  standalone: boolean; // already running as an installed app → let the app through
  platform: Platform;
  mobile: boolean; // ios or android
  inAppBrowser: boolean; // opened inside another app's browser — can't install here
  iosNonSafari: boolean; // iOS in Chrome/Firefox/etc — installing needs Safari
};

// True when the page runs as an installed PWA (its own window) rather than a
// normal browser tab. Covers the standard display-mode signals plus iOS Safari's
// legacy `navigator.standalone` flag.
export function isStandalone(
  matchMedia: ((query: string) => { matches: boolean }) | undefined,
  navStandalone?: boolean,
): boolean {
  const byDisplayMode = ['standalone', 'fullscreen', 'minimal-ui'].some(
    (mode) => matchMedia?.(`(display-mode: ${mode})`)?.matches ?? false,
  );
  return byDisplayMode || navStandalone === true;
}

// Which OS family, from the user-agent (plus the iPadOS-13+ heuristic: it
// presents a desktop-Mac UA but has a touch screen).
export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  const s = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(s)) return 'ios';
  if (s.includes('macintosh') && maxTouchPoints > 1) return 'ios';
  if (s.includes('android')) return 'android';
  return 'desktop';
}

// Opened inside another app's embedded browser (a link tapped in WhatsApp,
// Instagram, Facebook, etc.), where Install / Add-to-Home-Screen usually isn't
// available. Best-effort by known markers; `; wv)` is the Android WebView tag.
export function isInAppBrowser(ua: string): boolean {
  const s = ua.toLowerCase();
  return /fban|fbav|fb_iab|instagram|line\/|micromessenger|whatsapp|; wv\)|twitter|tiktok|snapchat|telegram|gsa\//.test(
    s,
  );
}

// iOS but not Safari. On iPhone/iPad, Add-to-Home-Screen only works from Safari;
// Chrome/Firefox/Edge/Opera on iOS carry these markers, and any in-app browser
// counts too.
export function isIosNonSafari(ua: string, platform: Platform): boolean {
  if (platform !== 'ios') return false;
  return /crios|fxios|edgios|opios/.test(ua.toLowerCase()) || isInAppBrowser(ua);
}

// Reads the whole environment off the live window. Not unit-tested (thin glue);
// the pure functions above carry the logic.
export function getInstallEnv(win: Window): InstallEnv {
  const nav = win.navigator;
  const ua = nav.userAgent ?? '';
  const platform = detectPlatform(ua, nav.maxTouchPoints ?? 0);
  return {
    standalone: isStandalone(
      (q) => win.matchMedia(q),
      (nav as Navigator & { standalone?: boolean }).standalone,
    ),
    platform,
    mobile: platform === 'ios' || platform === 'android',
    inAppBrowser: isInAppBrowser(ua),
    iosNonSafari: isIosNonSafari(ua, platform),
  };
}
