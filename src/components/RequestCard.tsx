import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';
import { translateText } from '../lib/translationApi';
import {
  reserveRequest,
  releaseRequest,
  commitRequest,
  deliverRequest,
  receiveRequest,
  deleteRequest,
  getPhotoUrl,
  removePhoto,
} from '../lib/requestsApi';
import { fieldNeedsTranslation } from '../lib/detectLanguage';
import { useAuth } from '../auth/AuthProvider';

type Props = {
  t: Dictionary;
  language: Language;
  request: CakeRequest;
  onUpdated: (updated: CakeRequest) => void;
  onDeleted: (id: string) => void;
};

type Mode = 'original' | 'translated';
type TranslateStatus = 'idle' | 'loading' | 'error';
type ActionStatus = 'idle' | 'saving' | 'error';

// The four typed-in text fields we may translate (the date is never translated).
type Translated = {
  recipient: string;
  occasion: string;
  dietary: string;
  location: string;
};
const TEXT_FIELDS = ['recipient', 'occasion', 'dietary', 'location'] as const;

export default function RequestCard({ t, language, request, onUpdated, onDeleted }: Props) {
  const { profile, session } = useAuth();
  const token = session?.access_token;

  const [mode, setMode] = useState<Mode>('original');
  const [translateStatus, setTranslateStatus] = useState<TranslateStatus>('idle');
  const [translated, setTranslated] = useState<Translated | null>(null);

  const [reserveStatus, setReserveStatus] = useState<ActionStatus>('idle');
  const [releaseStatus, setReleaseStatus] = useState<ActionStatus>('idle');
  const [commitStatus, setCommitStatus] = useState<ActionStatus>('idle');
  const [deliverStatus, setDeliverStatus] = useState<ActionStatus>('idle');
  const [receiveStatus, setReceiveStatus] = useState<ActionStatus>('idle');
  const [deleteStatus, setDeleteStatus] = useState<ActionStatus>('idle');
  const [photoFile, setPhotoFile] = useState<File | null>(null); // chosen at delivery
  const [photoUrl, setPhotoUrl] = useState<string | null>(null); // signed URL for viewing
  const [removePhotoStatus, setRemovePhotoStatus] = useState<ActionStatus>('idle');

  // A once-a-second clock, running only while this request is reserved, so the
  // countdown ticks and the card flips back to Open on its own when it expires.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (request.status !== 'reserved' || request.reservedUntil == null) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [request.status, request.reservedUntil]);

  // A fresh reservation is "active" only while its client-side countdown still
  // has time on it; once past, the card behaves as open again (the server agrees
  // on the next load). A committed request has no countdown — it stays claimed.
  const committed = request.status === 'committed';
  const delivered = request.status === 'delivered';
  const received = request.status === 'received';
  const reservedActive =
    request.status === 'reserved' && request.reservedUntil != null && request.reservedUntil > now;
  const claimed = committed || delivered || received || reservedActive;

  // Who can do what: only bakers/admins reserve; only the baker holding it (or an
  // admin) may commit / deliver / release; only the requester who owns it (or an
  // admin) confirms receipt. The server enforces the same rules — this just
  // decides which buttons to show.
  const isAdmin = profile?.role === 'admin';
  const isHolder = profile != null && (request.reservedByUserId === profile.id || isAdmin);
  // Only a verified baker (or an admin) may reserve; an unverified baker can
  // browse but not bake, and sees a "pending verification" note instead.
  const canReserve = (profile?.role === 'baker' && profile.verified) || isAdmin;
  const isUnverifiedBaker = profile?.role === 'baker' && !profile.verified;
  const canCommit = reservedActive && isHolder;
  const canDeliver = committed && isHolder;
  const canRelease = isHolder && (reservedActive || committed);
  const canReceive = delivered && profile != null && (request.ownerId === profile.id || isAdmin);

  // Who can remove this request: the requester who owns it (cancel their own) or
  // an admin (remove anything). Legacy rows have no owner, so only an admin. The
  // owner sees "Cancel request"; an admin acting on someone else's sees "Delete".
  const isOwner = profile != null && request.ownerId != null && request.ownerId === profile.id;
  const canDelete = isOwner || profile?.role === 'admin';

  // The finished-cake photo is private: only the owner, the baker who made it, or
  // an admin may see it. If allowed, we fetch a short-lived signed URL below.
  const canSeePhoto = request.hasPhoto && (isOwner || isHolder);
  // Admins can moderate (take down) a photo.
  const canModeratePhoto = isAdmin && request.hasPhoto;

  // Switching the language selector makes any earlier translation stale.
  useEffect(() => {
    setMode('original');
    setTranslateStatus('idle');
    setTranslated(null);
  }, [language]);

  // Once we know a photo exists and the viewer is allowed, fetch its signed URL.
  useEffect(() => {
    if (!canSeePhoto || !token || photoUrl) return;
    let cancelled = false;
    getPhotoUrl(request.id, token)
      .then((url) => !cancelled && setPhotoUrl(url))
      .catch(() => {}); // if it fails we simply don't show the photo
    return () => {
      cancelled = true;
    };
  }, [canSeePhoto, token, request.id, photoUrl]);

  const needsTranslation = TEXT_FIELDS.some((field) =>
    fieldNeedsTranslation(request[field], language),
  );

  async function handleTranslateClick() {
    if (mode === 'translated') {
      setMode('original');
      return;
    }
    if (translated) {
      setMode('translated');
      return;
    }
    setTranslateStatus('loading');
    const next: Translated = {
      recipient: request.recipient,
      occasion: request.occasion,
      dietary: request.dietary,
      location: request.location,
    };
    try {
      await Promise.all(
        TEXT_FIELDS.filter((field) => fieldNeedsTranslation(request[field], language)).map(
          async (field) => {
            next[field] = await translateText(request[field], language);
          },
        ),
      );
      setTranslated(next);
      setMode('translated');
      setTranslateStatus('idle');
    } catch {
      setTranslateStatus('error');
    }
  }

  async function handleReserve() {
    if (!token) return;
    setReserveStatus('saving');
    try {
      onUpdated(await reserveRequest(request.id, token));
      setReserveStatus('idle');
    } catch {
      setReserveStatus('error');
    }
  }

  async function handleRelease() {
    if (!token) return;
    setReleaseStatus('saving');
    try {
      onUpdated(await releaseRequest(request.id, token));
      setReleaseStatus('idle');
    } catch {
      setReleaseStatus('error');
    }
  }

  async function handleCommit() {
    if (!token) return;
    setCommitStatus('saving');
    try {
      onUpdated(await commitRequest(request.id, token));
      setCommitStatus('idle');
    } catch {
      setCommitStatus('error');
    }
  }

  async function handleDeliver() {
    if (!token) return;
    setDeliverStatus('saving');
    try {
      onUpdated(await deliverRequest(request.id, token, photoFile));
      setPhotoFile(null);
      setDeliverStatus('idle');
    } catch {
      setDeliverStatus('error');
    }
  }

  async function handleReceive() {
    if (!token) return;
    setReceiveStatus('saving');
    try {
      onUpdated(await receiveRequest(request.id, token));
      setReceiveStatus('idle');
    } catch {
      setReceiveStatus('error');
    }
  }

  async function handleRemovePhoto() {
    if (!token) return;
    if (!window.confirm(t.list.confirmRemovePhoto)) return;
    setRemovePhotoStatus('saving');
    try {
      const updated = await removePhoto(request.id, token);
      setPhotoUrl(null); // drop the now-stale signed URL
      onUpdated(updated); // hasPhoto is now false
      setRemovePhotoStatus('idle');
    } catch {
      setRemovePhotoStatus('error');
    }
  }

  async function handleDelete() {
    if (!token) return;
    // A deletion can't be undone, so ask before doing it.
    const confirmText = isOwner ? t.list.confirmCancel : t.list.confirmDelete;
    if (!window.confirm(confirmText)) return;
    setDeleteStatus('saving');
    try {
      await deleteRequest(request.id, token);
      onDeleted(request.id); // parent drops it from the list
    } catch {
      setDeleteStatus('error');
    }
  }

  const shown = mode === 'translated' && translated ? translated : request;
  const translateLabel =
    translateStatus === 'loading'
      ? t.list.translating
      : mode === 'translated'
        ? t.list.showOriginal
        : t.list.translate;

  const remainingMs = reservedActive ? request.reservedUntil! - now : 0;
  const minsLeft = Math.floor(remainingMs / 60000);
  const secsLeft = Math.floor((remainingMs % 60000) / 1000);

  const badgeStatus = received
    ? 'received'
    : delivered
      ? 'delivered'
      : committed
        ? 'committed'
        : reservedActive
          ? 'reserved'
          : 'open';
  const badgeLabel = received
    ? t.list.statusReceived
    : delivered
      ? t.list.statusDelivered
      : committed
        ? t.list.statusBaking
        : reservedActive
          ? t.list.statusReserved
          : t.list.statusOpen;

  return (
    <li className="request-card">
      <span className={`status-badge status-${badgeStatus}`}>{badgeLabel}</span>
      <h3>{shown.recipient}</h3>
      <p>{shown.occasion}</p>
      <p>
        {t.list.neededByPrefix} {request.neededBy}
      </p>
      <p>
        {t.list.locationPrefix} {shown.location}
      </p>
      {request.dietary && (
        <p>
          {t.list.dietaryPrefix} {shown.dietary}
        </p>
      )}

      {needsTranslation && (
        <>
          <button
            type="button"
            onClick={handleTranslateClick}
            disabled={translateStatus === 'loading'}
          >
            {translateLabel}
          </button>
          {translateStatus === 'error' && <p className="translate-error">{t.list.translateError}</p>}
        </>
      )}

      {claimed ? (
        <div
          className={`reserved-box${committed ? ' committed-box' : ''}${
            delivered ? ' delivered-box' : ''
          }${received ? ' received-box' : ''}`}
        >
          {request.reservedBy && (
            <p>
              {t.list.reservedByPrefix} {request.reservedBy}
            </p>
          )}
          {request.reservedContact && (
            <p>
              {t.list.reservedContactPrefix} {request.reservedContact}
            </p>
          )}
          {reservedActive && (
            <p className="countdown">
              {t.list.timeLeftPrefix} {minsLeft}m {secsLeft}s
            </p>
          )}
          {committed && <p className="baking-note">{t.list.bakingNote}</p>}
          {delivered && <p className="baking-note">{t.list.deliveredNote}</p>}
          {received && <p className="baking-note received-note">{t.list.receivedNote}</p>}
          {photoUrl && <img className="cake-photo" src={photoUrl} alt={t.list.photoAlt} />}
          {canModeratePhoto && (
            <>
              <button
                type="button"
                className="delete-button"
                onClick={handleRemovePhoto}
                disabled={removePhotoStatus === 'saving'}
              >
                {removePhotoStatus === 'saving' ? t.list.removingPhoto : t.list.removePhoto}
              </button>
              {removePhotoStatus === 'error' && (
                <p className="reserve-error">{t.list.removePhotoError}</p>
              )}
            </>
          )}
          {canDeliver && (
            <>
              <label className="photo-input">
                {t.list.addPhoto}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
                <small className="photo-hint">{t.list.photoPrivacyHint}</small>
              </label>
              <button
                type="button"
                className="reserve-button"
                onClick={handleDeliver}
                disabled={deliverStatus === 'saving'}
              >
                {deliverStatus === 'saving' ? t.list.delivering : t.list.markDelivered}
              </button>
              {deliverStatus === 'error' && <p className="reserve-error">{t.list.deliverError}</p>}
            </>
          )}
          {canReceive && (
            <>
              <button
                type="button"
                className="reserve-button"
                onClick={handleReceive}
                disabled={receiveStatus === 'saving'}
              >
                {receiveStatus === 'saving' ? t.list.confirming : t.list.confirmReceived}
              </button>
              {receiveStatus === 'error' && <p className="reserve-error">{t.list.receiveError}</p>}
            </>
          )}
          {canCommit && (
            <>
              <button
                type="button"
                className="reserve-button"
                onClick={handleCommit}
                disabled={commitStatus === 'saving'}
              >
                {commitStatus === 'saving' ? t.list.committing : t.list.commit}
              </button>
              {commitStatus === 'error' && <p className="reserve-error">{t.list.commitError}</p>}
            </>
          )}
          {canRelease && (
            <>
              <button type="button" onClick={handleRelease} disabled={releaseStatus === 'saving'}>
                {releaseStatus === 'saving' ? t.list.releasing : t.list.release}
              </button>
              {releaseStatus === 'error' && <p className="reserve-error">{t.list.releaseError}</p>}
            </>
          )}
        </div>
      ) : canReserve ? (
        <>
          <button
            type="button"
            className="reserve-button"
            onClick={handleReserve}
            disabled={reserveStatus === 'saving'}
          >
            {reserveStatus === 'saving' ? t.list.reserving : t.list.reserve}
          </button>
          {reserveStatus === 'error' && <p className="reserve-error">{t.list.reserveError}</p>}
        </>
      ) : (
        isUnverifiedBaker && <p className="pending-note">{t.list.pendingVerification}</p>
      )}

      {canDelete && (
        <div className="card-actions">
          <button
            type="button"
            className="delete-button"
            onClick={handleDelete}
            disabled={deleteStatus === 'saving'}
          >
            {deleteStatus === 'saving'
              ? t.list.deleting
              : isOwner
                ? t.list.cancelRequest
                : t.list.deleteRequest}
          </button>
          {deleteStatus === 'error' && <p className="reserve-error">{t.list.deleteError}</p>}
        </div>
      )}
    </li>
  );
}
