import { describe, expect, it } from 'vitest';
import { validateConnectForm } from './online-form';

describe('validateConnectForm', () => {
  it('rejects an empty or whitespace-only name when creating', () => {
    expect(validateConnectForm('create', '', '')).toBe('Please enter your name');
    expect(validateConnectForm('create', '   ', '')).toBe('Please enter your name');
    expect(validateConnectForm('create', '\u200B', '')).toBe('Please enter your name');
  });

  it('accepts a name when creating, ignoring the room code', () => {
    expect(validateConnectForm('create', 'Tester', '')).toBeNull();
  });

  it('requires both name and room code when joining', () => {
    expect(validateConnectForm('join', '', 'ABCD1234')).toBe('Please enter name and room code');
    expect(validateConnectForm('join', 'Tester', '  ')).toBe('Please enter name and room code');
    expect(validateConnectForm('join', 'Tester', 'ABCD1234')).toBeNull();
  });
});
