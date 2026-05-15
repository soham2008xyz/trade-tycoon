import { describe, expect, it } from 'vitest';
import { pickLayout } from './useGameLayout';

describe('pickLayout', () => {
  it('returns "phone" when the shorter side is below the breakpoint', () => {
    expect(pickLayout(390, 844)).toBe('phone'); // iPhone 14 portrait
    expect(pickLayout(844, 390)).toBe('phone'); // iPhone 14 landscape
    expect(pickLayout(599, 1024)).toBe('phone'); // narrow web window
  });

  it('returns "tablet" when the shorter side is at or above the breakpoint', () => {
    expect(pickLayout(600, 800)).toBe('tablet'); // exactly at breakpoint
    expect(pickLayout(820, 1180)).toBe('tablet'); // iPad portrait
    expect(pickLayout(1024, 1366)).toBe('tablet'); // iPad Pro
  });

  it('treats zero dimensions as phone (safe default while measuring)', () => {
    expect(pickLayout(0, 0)).toBe('phone');
  });
});
