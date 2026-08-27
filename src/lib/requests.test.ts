import { describe, it, expect } from 'vitest';
import { findMissingFields } from './requests';
import type { RequestDraft } from '../types';

const fullDraft: RequestDraft = {
  recipient: 'Maya',
  occasion: '8th birthday, dinosaurs',
  neededBy: '2026-09-01',
  dietary: '',
  location: 'Haifa',
  kashrut: 'Rabbanut',
  aboutRecipient: '',
  contactPhone: '050-1234567',
};

describe('findMissingFields', () => {
  it('returns an empty array when all required fields are filled', () => {
    expect(findMissingFields(fullDraft)).toEqual([]);
  });

  it('lists the required fields that are blank or only spaces', () => {
    const draft: RequestDraft = { ...fullDraft, recipient: '', location: '   ' };
    expect(findMissingFields(draft).sort()).toEqual(['location', 'recipient']);
  });

  it('does not require the dietary or aboutRecipient fields', () => {
    const draft: RequestDraft = { ...fullDraft, dietary: '', aboutRecipient: '' };
    expect(findMissingFields(draft)).toEqual([]);
  });

  it('requires the kashrut field', () => {
    const draft: RequestDraft = { ...fullDraft, kashrut: '' };
    expect(findMissingFields(draft)).toEqual(['kashrut']);
  });
});
