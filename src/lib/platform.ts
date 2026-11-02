// Browser-only checks for the installed app and iPhone/iPad. Call them after hydration.

export const STANDALONE_QUERY = "(display-mode: standalone)";

// Running as an installed app (any browser), or from the iOS Home Screen.
export function isStandalone() {
  // navigator.standalone is iOS Safari's own flag for a Home Screen app
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia(STANDALONE_QUERY).matches || iosStandalone;
}

// iPadOS reports itself as a Mac, so also check for touch.
export function isIos() {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}
