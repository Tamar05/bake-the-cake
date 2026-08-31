import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import { useAuth } from '../auth/AuthProvider';
import { AREAS, DIETARY_OPTIONS, KASHRUT_OPTIONS } from '../lib/options';
import { getNotificationSettings, saveNotificationSettings } from '../lib/notificationsApi';
import {
  isPushSupported,
  isSubscribedOnThisDevice,
  enablePushOnThisDevice,
  disablePushOnThisDevice,
} from '../lib/pushApi';
import CapabilityGroup from '../components/CapabilityGroup';

type Status = 'loading' | 'ready' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type PushState = 'off' | 'on';

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

  // Per-device web push: whether this browser can do it, whether it's already on
  // for this device, a busy flag, and any error message to show.
  const [pushSupported] = useState(isPushSupported);
  const [pushState, setPushState] = useState<PushState>('off');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

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

  // Reflect whether this device already holds a push subscription, so the toggle
  // shows the right state on load.
  useEffect(() => {
    isSubscribedOnThisDevice().then((on) => setPushState(on ? 'on' : 'off'));
  }, []);

  // Maps an enable/disable failure to a friendly message.
  function pushErrorMessage(err: unknown): string {
    const code = err instanceof Error ? err.message : '';
    if (code === 'unsupported') return t.notifications.push.unsupported;
    if (code === 'denied') return t.notifications.push.denied;
    return t.notifications.push.error;
  }

  async function handleTogglePush() {
    if (!token) return;
    setPushBusy(true);
    setPushError(null);
    try {
      if (pushState === 'on') {
        await disablePushOnThisDevice(token);
        setPushState('off');
      } else {
        await enablePushOnThisDevice(token);
        setPushState('on');
      }
    } catch (err) {
      setPushError(pushErrorMessage(err));
    } finally {
      setPushBusy(false);
    }
  }

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

          <div className="push-section">
            <h3>{t.notifications.push.heading}</h3>
            <p className="notifications-intro">{t.notifications.push.intro}</p>
            {!pushSupported ? (
              <p className="list-status">{t.notifications.push.unsupported}</p>
            ) : (
              <>
                <button type="button" onClick={handleTogglePush} disabled={pushBusy}>
                  {pushBusy
                    ? t.notifications.push.working
                    : pushState === 'on'
                      ? t.notifications.push.disable
                      : t.notifications.push.enable}
                </button>
                {pushState === 'on' && !pushBusy && (
                  <p className="notifications-saved">{t.notifications.push.enabled}</p>
                )}
                {pushError && <p className="reserve-error">{pushError}</p>}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
