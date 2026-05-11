import { describe, expect, it } from 'vitest';
import { getIpadNativePresentation, isNativeIpadShell } from './ipad-native-presentation';

describe('ipad-native-presentation', () => {
  it('does not enable the native iPad shell on phones or non-iOS platforms', () => {
    expect(isNativeIpadShell({ platform: 'ios', isPad: false, width: 1024, height: 768 })).toBe(
      false
    );
    expect(isNativeIpadShell({ platform: 'android', isPad: false, width: 1024, height: 768 })).toBe(
      false
    );
    expect(isNativeIpadShell({ platform: 'web', isPad: false, width: 1366, height: 1024 })).toBe(
      false
    );
  });

  it('enables the native shell for iPad builds', () => {
    expect(isNativeIpadShell({ platform: 'ios', isPad: true, width: 1024, height: 768 })).toBe(
      true
    );
  });

  it('uses a side-by-side shell for landscape iPad layouts', () => {
    expect(
      getIpadNativePresentation({ platform: 'ios', isPad: true, width: 1180, height: 820 })
    ).toEqual({
      isNativeIpadShell: true,
      isLandscape: true,
      shellDirection: 'row',
      shellPadding: 24,
      sidebarWidth: 280,
    });
  });

  it('keeps portrait iPad layouts stacked vertically', () => {
    expect(
      getIpadNativePresentation({ platform: 'ios', isPad: true, width: 820, height: 1180 })
    ).toEqual({
      isNativeIpadShell: true,
      isLandscape: false,
      shellDirection: 'column',
      shellPadding: 20,
      sidebarWidth: 0,
    });
  });

  it('falls back to the compact shell on iPhone-sized layouts', () => {
    expect(
      getIpadNativePresentation({ platform: 'ios', isPad: false, width: 430, height: 932 })
    ).toEqual({
      isNativeIpadShell: false,
      isLandscape: false,
      shellDirection: 'column',
      shellPadding: 0,
      sidebarWidth: 0,
    });
  });
});
