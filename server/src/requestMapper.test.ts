import { describe, it, expect } from 'vitest';
import { rowToRequest } from './requestMapper';

describe('rowToRequest', () => {
  it('maps snake_case columns to the camelCase request shape', () => {
    const row = {
      id: 'abc',
      recipient: 'Maya',
      occasion: '8th birthday',
      needed_by: '2026-09-01',
      dietary: 'nut-free',
      location: 'Haifa',
      created_at: '2026-08-20T10:00:00.000Z',
    };
    expect(rowToRequest(row)).toEqual({
      id: 'abc',
      recipient: 'Maya',
      occasion: '8th birthday',
      neededBy: '2026-09-01',
      dietary: 'nut-free',
      location: 'Haifa',
      createdAt: Date.parse('2026-08-20T10:00:00.000Z'),
    });
  });
});
