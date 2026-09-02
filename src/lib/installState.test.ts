import { describe, it, expect } from 'vitest';
import {
  isStandalone,
  detectPlatform,
  isInAppBrowser,
  isIosNonSafari,
} from './installState';

// Representative user-agent strings.
const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  androidWhatsApp:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  ipadOS:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};

const media = (matches: boolean) => () => ({ matches });

describe('isStandalone', () => {
  it('is true when a display-mode media query matches', () => {
    expect(isStandalone(media(true))).toBe(true);
  });
  it('is true for iOS Safari legacy navigator.standalone', () => {
    expect(isStandalone(media(false), true)).toBe(true);
  });
  it('is false in a normal browser tab', () => {
    expect(isStandalone(media(false), false)).toBe(false);
  });
  it('is false when matchMedia is unavailable and no legacy flag', () => {
    expect(isStandalone(undefined)).toBe(false);
  });
});

describe('detectPlatform', () => {
  it('detects iPhone', () => expect(detectPlatform(UA.iphoneSafari)).toBe('ios'));
  it('detects Android', () => expect(detectPlatform(UA.androidChrome)).toBe('android'));
  it('detects desktop Windows', () => expect(detectPlatform(UA.windows)).toBe('desktop'));
  it('treats iPadOS (Mac UA + touch) as ios', () =>
    expect(detectPlatform(UA.ipadOS, 5)).toBe('ios'));
  it('treats a real Mac (no touch) as desktop', () =>
    expect(detectPlatform(UA.ipadOS, 0)).toBe('desktop'));
});

describe('isInAppBrowser', () => {
  it('flags an Android WebView (WhatsApp)', () =>
    expect(isInAppBrowser(UA.androidWhatsApp)).toBe(true));
  it('flags Instagram in-app', () => expect(isInAppBrowser(UA.iphoneInstagram)).toBe(true));
  it('is false for normal Chrome', () => expect(isInAppBrowser(UA.androidChrome)).toBe(false));
  it('is false for normal Safari', () => expect(isInAppBrowser(UA.iphoneSafari)).toBe(false));
});

describe('isIosNonSafari', () => {
  it('is true for Chrome on iOS', () =>
    expect(isIosNonSafari(UA.iphoneChrome, 'ios')).toBe(true));
  it('is true for an in-app browser on iOS', () =>
    expect(isIosNonSafari(UA.iphoneInstagram, 'ios')).toBe(true));
  it('is false for real Safari on iOS', () =>
    expect(isIosNonSafari(UA.iphoneSafari, 'ios')).toBe(false));
  it('is false on Android regardless', () =>
    expect(isIosNonSafari(UA.androidChrome, 'android')).toBe(false));
});
