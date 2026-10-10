import { useState } from 'react';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import { useAuth } from '../auth/AuthProvider';
import { DIETARY_OPTIONS, KASHRUT_OPTIONS, toggleOption, setOtherFreeText } from '../lib/options';
import { saveNotificationSettings } from '../lib/notificationsApi';
import CapabilityGroup from '../components/CapabilityGroup';
import TownField from '../components/TownField';

const DEFAULT_TRAVEL_RADIUS_KM = 15;

// Shown once to a new baker, right after they confirm their email: the area /
// kashrut / dietary questions that used to sit on the sign-up form. Saving opts
// them in to new-request notifications; skipping just dismisses it. Either way
// markSetupDone() records it, so it never reappears (they can still change
// everything later in Notifications).
export default function BakerSetupPage({ t, language }: { t: Dictionary; language: Language }) {
  const { session, markSetupDone } = useAuth();
  const token = session?.access_token;
  const [homeTown, setHomeTown] = useState('');
  const [travelRadiusKm, setTravelRadiusKm] = useState(DEFAULT_TRAVEL_RADIUS_KM);
  const [kashrut, setKashrut] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function finish(save: boolean) {
    if (!token) return;
    setBusy(true);
    setError(false);
    try {
      if (save) {
        await saveNotificationSettings(
          { notifyNewRequests: true, homeTown, travelRadiusKm, dietary, kashrut },
          token,
        );
      }
      await markSetupDone();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <section className="request-form notifications-form">
      <h2>{t.setup.heading}</h2>
      <p className="notifications-intro">{t.setup.intro}</p>
      <TownField
        label={t.notifications.homeTownLabel}
        value={homeTown}
        onChange={setHomeTown}
        hint={t.notifications.homeTownHint}
        language={language}
      />
      <label>
        {t.notifications.travelRadiusLabel}
        <input
          type="number"
          min={1}
          max={300}
          value={travelRadiusKm}
          onChange={(e) => setTravelRadiusKm(Number(e.target.value))}
        />
      </label>
      <CapabilityGroup
        legend={t.notifications.kashrutLabel}
        options={KASHRUT_OPTIONS}
        labels={t.options.kashrut}
        selected={kashrut}
        onToggle={(v) => setKashrut(toggleOption(kashrut, v))}
      />
      <CapabilityGroup
        legend={t.notifications.dietaryLabel}
        options={DIETARY_OPTIONS}
        labels={t.options.dietary}
        selected={dietary}
        onToggle={(v) => setDietary(toggleOption(dietary, v))}
        onOtherTextChange={(text) => setDietary(setOtherFreeText(dietary, text))}
        otherPlaceholder={t.options.otherPlaceholder}
      />
      {error && <p className="reserve-error">{t.setup.error}</p>}
      <div className="auth-actions">
        <button type="button" onClick={() => finish(true)} disabled={busy}>
          {busy ? t.setup.saving : t.setup.save}
        </button>
        <button type="button" className="auth-link" onClick={() => finish(false)} disabled={busy}>
          {t.setup.skip}
        </button>
      </div>
    </section>
  );
}
