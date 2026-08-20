import { describe, it, expect } from 'vitest';
import { findMissingFields, createRequest } from './requests';
import type { RequestDraft } from '../types';

const fullDraft: RequestDraft = {
  recipient: 'Maya',
  occasion: '8th birthday, dinosaurs',
  neededBy: '2026-09-01',
  dietary: '',
  location: 'Haifa',
};

describe('findMissingFields', () => {
  it('returns an empty array when all required fields are filled', () => {
    expect(findMissingFields(fullDraft)).toEqual([]);
  });

  it('lists the required fields that are blank or only spaces', () => {
    const draft: RequestDraft = { ...fullDraft, recipient: '', location: '   ' };
    expect(findMissingFields(draft).sort()).toEqual(['location', 'recipient']);
  });

  it('does not require the dietary field', () => {
    const draft: RequestDraft = { ...fullDraft, dietary: '' };
    expect(findMissingFields(draft)).toEqual([]);
  });
});

describe('createRequest', () => {
  it('copies the draft fields, trimming surrounding spaces', () => {
    const draft: RequestDraft = { ...fullDraft, recipient: '  Maya  ' };
    const request = createRequest(draft);
    expect(request.recipient).toBe('Maya');
    expect(request.occasion).toBe('8th birthday, dinosaurs');
    expect(request.location).toBe('Haifa');
  });

  it('gives each request a different id', () => {
    const a = createRequest(fullDraft);
    const b = createRequest(fullDraft);
    expect(a.id).not.toBe(b.id);
  });
});
