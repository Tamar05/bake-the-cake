import { useNavigate } from 'react-router-dom';
import RequestForm from '../components/RequestForm';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { RequestDraft } from '../types';

type Props = {
  t: Dictionary;
  language: Language;
  onAdd: (draft: RequestDraft) => void;
};

// Its own tab (rather than a form buried at the bottom of "My requests") so
// posting a new request is a one-click destination for an organization,
// not something they have to scroll past their existing requests to find.
export default function NewRequestPage({ t, language, onAdd }: Props) {
  const navigate = useNavigate();

  function handleAdd(draft: RequestDraft) {
    onAdd(draft);
    navigate('/my');
  }

  return <RequestForm t={t} language={language} onSubmit={handleAdd} />;
}
