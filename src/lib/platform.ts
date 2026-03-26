"use client";

export function isIOSLikeDevice(): boolean {
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isIPadOSDesktopUA =
    window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return isIOS || isIPadOSDesktopUA;
}

export function isAndroidDevice(): boolean {
  return /android/.test(window.navigator.userAgent.toLowerCase());
}

export function isStandaloneAppDisplay(): boolean {
  const legacyStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const androidStandalone = window.document.referrer.startsWith("android-app://");
  const displayModeStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)")?.matches === true ||
    window.matchMedia?.("(display-mode: minimal-ui)")?.matches === true;

  return legacyStandalone || androidStandalone || displayModeStandalone;
}
