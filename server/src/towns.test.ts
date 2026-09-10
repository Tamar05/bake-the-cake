import { describe, it, expect } from 'vitest';
import * as server from './towns';
// The client copy, imported straight from the frontend package (same pattern
// as options.test.ts) — a real guarantee the two lists never drift apart.
import * as client from '../../src/lib/towns';

describe('town list parity (client ⇄ server)', () => {
  it('town lists match', () => {
    expect([...client.TOWNS]).toEqual([...server.TOWNS]);
  });

  it('OTHER_PREFIX matches', () => {
    expect(client.OTHER_PREFIX).toBe(server.OTHER_PREFIX);
  });
});

describe('town list data quality', () => {
  it('has no duplicate names', () => {
    const names = server.TOWNS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every town has plausible Israel coordinates', () => {
    for (const t of server.TOWNS) {
      expect(t.lat).toBeGreaterThan(29);
      expect(t.lat).toBeLessThan(34);
      expect(t.lng).toBeGreaterThan(34);
      expect(t.lng).toBeLessThan(36.5);
    }
  });

  it('includes Bet Shemesh (the town most existing data maps to)', () => {
    expect(server.findTown('Bet Shemesh')).toBeDefined();
  });
});

describe('findTown', () => {
  it('finds an exact match', () => {
    expect(server.findTown('Tel Aviv')?.name).toBe('Tel Aviv');
  });

  it('returns undefined for an unknown name', () => {
    expect(server.findTown('Not A Real Town')).toBeUndefined();
  });

  it('is case-sensitive (no fuzzy matching)', () => {
    expect(server.findTown('tel aviv')).toBeUndefined();
  });
});

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    const p = { lat: 31.7683, lng: 35.2137 };
    expect(server.distanceKm(p, p)).toBeCloseTo(0, 5);
  });

  it('matches a known real-world distance (Jerusalem to Tel Aviv, ~54km)', () => {
    const jerusalem = server.findTown('Jerusalem')!;
    const telAviv = server.findTown('Tel Aviv')!;
    expect(server.distanceKm(jerusalem, telAviv)).toBeGreaterThan(50);
    expect(server.distanceKm(jerusalem, telAviv)).toBeLessThan(60);
  });

  it('is symmetric', () => {
    const a = server.findTown('Haifa')!;
    const b = server.findTown('Eilat')!;
    expect(server.distanceKm(a, b)).toBeCloseTo(server.distanceKm(b, a), 10);
  });
});
