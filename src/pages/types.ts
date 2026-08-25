import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';

// What every request-list view needs: the dictionary + language for display, the
// requests to show, and the callbacks that keep the shared list in step when a
// card reserves/releases (onUpdated) or is removed (onDeleted).
export type ListPageProps = {
  t: Dictionary;
  language: Language;
  requests: CakeRequest[];
  onUpdated: (updated: CakeRequest) => void;
  onDeleted: (id: string) => void;
};
