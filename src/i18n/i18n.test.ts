import { describe, it, expect } from 'vitest';
import { en } from './en';
import { he } from './he';

// Walks a nested object and returns every leaf's dotted path, e.g. "form.submit".
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? keyPaths(value as Record<string, unknown>, path)
      : [path];
  });
}

describe('i18n dictionaries', () => {
  it('English and Hebrew have exactly the same keys', () => {
    expect(keyPaths(he).sort()).toEqual(keyPaths(en).sort());
  });
});
