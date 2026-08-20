import type { Language } from '../i18n/language';
import type { Dictionary } from '../i18n/types';

type Props = {
  t: Dictionary;
  language: Language;
  onChange: (language: Language) => void;
};

// Button faces stay the literal language names (shown in their own script
// regardless of the active language), so they are not dictionary strings.
const OPTIONS: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'he', label: 'עברית' },
];

export default function LanguageToggle({ t, language, onChange }: Props) {
  return (
    <div className="language-toggle" role="group" aria-label={t.languageLabel}>
      {OPTIONS.map((option) => (
        <button
          key={option.code}
          type="button"
          className={option.code === language ? 'active' : ''}
          aria-pressed={option.code === language}
          onClick={() => onChange(option.code)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
