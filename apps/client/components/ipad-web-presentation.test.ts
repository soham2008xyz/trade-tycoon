import { describe, expect, it } from 'vitest';
import { getIpadWebPresentation, isTabletWebViewport } from './ipad-web-presentation';

describe('ipad-web-presentation', () => {
  it('does not enable the iPad web shell outside the web platform', () => {
    expect(isTabletWebViewport({ platform: 'ios', width: 1024, height: 768 })).toBe(false);
    expect(isTabletWebViewport({ platform: 'android', width: 1024, height: 768 })).toBe(false);
  });

  it('treats classic iPad-sized web viewports as tablet surfaces', () => {
    expect(isTabletWebViewport({ platform: 'web', width: 1024, height: 768 })).toBe(true);
    expect(isTabletWebViewport({ platform: 'web', width: 744, height: 1133 })).toBe(true);
  });

  it('keeps phones and small browser windows on the default shell', () => {
    expect(isTabletWebViewport({ platform: 'web', width: 430, height: 932 })).toBe(false);
    expect(isTabletWebViewport({ platform: 'web', width: 900, height: 700 })).toBe(false);
  });

  it('uses a side-by-side shell for landscape iPad web viewports', () => {
    expect(getIpadWebPresentation({ platform: 'web', width: 1180, height: 820 })).toEqual({
      isTabletWebViewport: true,
      isLandscape: true,
      shellDirection: 'row',
      shellPadding: 24,
      sidebarWidth: 280,
    });
  });

  it('keeps portrait tablet shells stacked vertically', () => {
    expect(getIpadWebPresentation({ platform: 'web', width: 820, height: 1180 })).toEqual({
      isTabletWebViewport: true,
      isLandscape: false,
      shellDirection: 'column',
      shellPadding: 20,
      sidebarWidth: 0,
    });
  });
});
