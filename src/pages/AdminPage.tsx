import RequestList from '../components/RequestList';
import type { ListPageProps } from './types';

// The admin's manage-everything view: every request, with the All/Open/Reserved
// filter and full controls. An admin can release any reservation and delete any
// request (including the legacy anonymous ones nobody owns).
export default function AdminPage({ t, language, requests, onUpdated, onDeleted }: ListPageProps) {
  return (
    <RequestList
      t={t}
      language={language}
      requests={requests}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
      heading={t.views.adminHeading}
    />
  );
}
