/**
 * instagramRedirect.ts
 * Detects Instagram's in-app browser and redirects users to their default browser.
 *
 * Android → Intent URL (zero taps, fully automatic)
 * iOS     → URL scheme tricks that trigger Instagram's native "Open outside Instagram?" dialog (1 tap)
 */

export type Platform = "android" | "ios" | "other";

/** Returns true if the current browser is Instagram's in-app WebView */
export function isInstagramBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return ua.includes("Instagram") || ua.includes("FBAN") || ua.includes("FBAV");
}

/** Detects the OS platform */
export function getPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "other";
}

/**
 * Strips the protocol from a URL and returns host + path + query.
 * e.g. "https://flashresume.in/analyze?foo=1" → "flashresume.in/analyze?foo=1"
 */
function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * Android: Fire an Android Intent URL.
 * This tells the OS to hand the URL off to the default browser with zero user interaction.
 */
export function redirectAndroid(destination: string): void {
  const stripped = stripProtocol(destination);
  // Primary intent — opens in system default browser
  const intentUrl =
    `intent://${stripped}` +
    `#Intent;` +
    `scheme=https;` +
    `action=android.intent.action.VIEW;` +
    `S.browser_fallback_url=${encodeURIComponent(destination)};` +
    `end`;

  window.location.href = intentUrl;

  // Safety net: if intent didn't fire within 1.5s, go direct
  setTimeout(() => {
    window.location.href = destination;
  }, 1500);
}

/**
 * iOS: Try URL schemes that trigger Instagram's native
 * "This web page is trying to open an app outside of Instagram" dialog.
 * User taps "Open" → lands in their browser. (1 tap)
 *
 * We try Chrome first, then x-safari, then Firefox as fallbacks.
 */
export function redirectIOS(destination: string): void {
  const stripped = stripProtocol(destination);
  const encoded = encodeURIComponent(destination);

  const schemes = [
    // Chrome (most common on Android too, works on many iOS devices)
    `googlechrome://${stripped}`,
    // Safari via x-safari-https (works on iOS Safari scheme handler)
    `x-safari-https://${stripped}`,
    // Firefox for iOS
    `firefox://open-url?url=${encoded}`,
    // Opera Touch
    `touch-https://${stripped}`,
  ];

  // Fire them with small offsets — Instagram will show dialog on the first one that matches
  schemes.forEach((scheme, index) => {
    setTimeout(() => {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = scheme;
      document.body.appendChild(iframe);
      setTimeout(() => document.body.removeChild(iframe), 500);
    }, index * 150);
  });

  // Also try direct location for the first scheme
  setTimeout(() => {
    window.location.href = schemes[0];
  }, 50);
}

/**
 * Main entry point — call this on page load inside the /open route.
 * Returns false if not in Instagram IAB (caller should just redirect normally).
 */
export function handleInstagramRedirect(destination: string): boolean {
  if (!isInstagramBrowser()) return false;

  const platform = getPlatform();

  if (platform === "android") {
    redirectAndroid(destination);
    return true;
  }

  if (platform === "ios") {
    redirectIOS(destination);
    return true;
  }

  return false;
}
