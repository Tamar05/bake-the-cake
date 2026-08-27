import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import { useAuth } from '../auth/AuthProvider';
import { AREAS, DIETARY_OPTIONS, KASHRUT_OPTIONS } from '../lib/options';
import { optionLabel } from '../lib/optionLabels';
import { getNotificationSettings, saveNotificationSettings } from '../lib/notificationsApi';

type Status = 'loading' | 'ready' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// A bordered group of checkboxes for one capability list (areas / dietary /
// kashrut). Selecting a value toggles it in the chosen set.
function CapabilityGroup({
  legend,
  options,
  labels,
  selected,
  onToggle,
}: {
  legend: string;
  options: readonly string[];
  labels: Record<string, string>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="options-fieldset">
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option} className="checkbox-option">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
          />
          {optionLabel(labels, option)}
        </label>
      ))}
    </fieldset>
  );
}

// Baker-only screen: opt in to new-request notifications and choose which areas,
// dietary needs and kashrut levels you can make. The 🔔 bell only counts a new
// request as relevant when it matches all three of these (see the matcher).
export default function BakerNotificationsPage({ t }: { t: Dictionary }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [status, setStatus] = useState<Status>('loading');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [notifyNewRequests, setNotifyNewRequests] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [kashrut, setKashrut] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;
    setStatus('loading');
    getNotificationSettings(token)
      .then((s) => {
        setNotifyNewRequests(s.notifyNewRequests);
        setAreas(s.areas);
        setDietary(s.dietary);
        setKashrut(s.kashrut);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  // Any edit invalidates the "Saved ✓" note so it never looks stale.
  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
    setSaveStatus('idle');
  }

  async function handleSave() {
    if (!token) return;
    setSaveStatus('saving');
    try {
      await saveNotificationSettings({ notifyNewRequests, areas, dietary, kashrut }, token);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  return (
    <section className="request-form notifications-form">
      <h2>{t.notifications.heading}</h2>
      <p className="notifications-intro">{t.notifications.intro}</p>

      {status === 'loading' && <p className="list-status">{t.notifications.loading}</p>}
      {status === 'error' && <p className="list-status list-error">{t.notifications.loadError}</p>}
      {status === 'ready' && (
        <>
          <label className="checkbox-option enable-toggle">
            <input
              type="checkbox"
              checked={notifyNewRequests}
              onChange={(e) => {
                setNotifyNewRequests(e.target.checked);
                setSaveStatus('idle');
              }}
            />
            {t.notifications.enableLabel}
          </label>

          <CapabilityGroup
            legend={t.notifications.areasLabel}
            options={AREAS}
            labels={t.options.area}
            selected={areas}
            onToggle={(v) => toggle(areas, setAreas, v)}
          />
          <CapabilityGroup
            legend={t.notifications.dietaryLabel}
            options={DIETARY_OPTIONS}
            labels={t.options.dietary}
            selected={dietary}
            onToggle={(v) => toggle(dietary, setDietary, v)}
          />
          <CapabilityGroup
            legend={t.notifications.kashrutLabel}
            options={KASHRUT_OPTIONS}
            labels={t.options.kashrut}
            selected={kashrut}
            onToggle={(v) => toggle(kashrut, setKashrut, v)}
          />

          <button type="button" onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? t.notifications.saving : t.notifications.save}
          </button>
          {saveStatus === 'saved' && <p className="notifications-saved">{t.notifications.saved}</p>}
          {saveStatus === 'error' && <p className="reserve-error">{t.notifications.saveError}</p>}
        </>
      )}
    </section>
  );
}
