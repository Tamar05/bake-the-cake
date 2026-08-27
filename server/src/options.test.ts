import { describe, it, expect } from 'vitest';
import * as server from './options';
// The client copy, imported straight from the frontend package. Both files are
// pure constants, so this cross-package import is safe and gives a real
// guarantee the two lists never drift apart (relevance matching depends on it).
import * as client from '../../src/lib/options';

describe('option lists parity (client ⇄ server)', () => {
  it('areas match', () => {
    expect([...client.AREAS]).toEqual([...server.AREAS]);
  });

  it('dietary options match', () => {
    expect([...client.DIETARY_OPTIONS]).toEqual([...server.DIETARY_OPTIONS]);
  });

  it('kashrut options match', () => {
    expect([...client.KASHRUT_OPTIONS]).toEqual([...server.KASHRUT_OPTIONS]);
  });

  it('dietary separator matches', () => {
    expect(client.DIETARY_SEPARATOR).toBe(server.DIETARY_SEPARATOR);
  });
});

describe('dietary join/parse', () => {
  it('round-trips a multi-select selection', () => {
    const chosen = ['nut-free', 'vegan'];
    expect(server.parseDietary(server.joinDietary(chosen))).toEqual(chosen);
  });

  it('parses tolerantly and drops blanks', () => {
    expect(server.parseDietary('nut-free ,  vegan , ')).toEqual(['nut-free', 'vegan']);
  });

  it('treats an empty string as no needs', () => {
    expect(server.parseDietary('')).toEqual([]);
  });
});
