import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest, RequestDraft } from '../types';
import { translateText } from '../lib/translationApi';
import {
  reserveRequest,
  releaseRequest,
  commitRequest,
  deliverRequest,
  receiveRequest,
  deleteRequest,
  updateRequest,
  getPhotoUrl,
  removePhoto,
  setGalleryShare,
} from '../lib/requestsApi';
import { fieldNeedsTranslation } from '../lib/detectLanguage';
import { parseList } from '../lib/options';
import { optionLabel } from '../lib/optionLabels';
import { useAuth } from '../auth/AuthProvider';
import RequestForm from './RequestForm';
import Timeline from './Timeline';

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

// The free-text fields we may machine-translate. Area, dietary and kashrut are
// no longer here: they're chosen from shared lists and shown via per-language
// labels, so they never need the translation service.
type Translated = {
  recipient: string;
  occasion: string;
  aboutRecipient: string;
};
const TEXT_FIELDS = ['recipient', 'occasion', 'aboutRecipient'] as const;

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
  const [caption, setCaption] = useState(request.galleryCaption); // gallery message
  const [galleryStatus, setGalleryStatus] = useState<ActionStatus>('idle');
  const [editing, setEditing] = useState(false); // owner is editing this request
  const [editError, setEditError] = useState(false);

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
  // An admin can remove anything; a requester can cancel their own request only
  // until it's delivered — once a cake is on its way, it's no longer cancellable.
  const canDelete = isAdmin || (isOwner && !delivered && !received);
  // The owner (or an admin) may edit the details, but only while the request is
  // still open — once a baker has taken it, it's locked (the server agrees).
  const canEdit = (isOwner || isAdmin) && request.status === 'open';

  // The finished-cake photo is private: only the owner, the baker who made it, or
  // an admin may see it. If allowed, we fetch a short-lived signed URL below.
  const canSeePhoto = request.hasPhoto && (isOwner || isHolder);
  // Admins can moderate (take down) a photo.
  const canModeratePhoto = isAdmin && request.hasPhoto;

  // Public gallery: a finished cake with a photo can be shared, but only once
  // BOTH the requester and the baker agree. Each toggles their own consent.
  const isBaker = profile != null && request.reservedByUserId === profile.id;
  const canShareGallery = received && request.hasPhoto && (isOwner || isBaker);
  const myShared = isOwner ? request.sharedByOwner : isBaker ? request.sharedByBaker : false;
  const bothShared = request.sharedByOwner && request.sharedByBaker;

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
      aboutRecipient: request.aboutRecipient,
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

  async function saveGalleryShare(share: boolean) {
    if (!token) return;
    setGalleryStatus('saving');
    try {
      onUpdated(await setGalleryShare(request.id, share, token, caption));
      setGalleryStatus('idle');
    } catch {
      setGalleryStatus('error');
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

  // Saving an edit: PATCH the whole draft, swap in the updated request, close the
  // editor. A 409 (a baker grabbed it first) or any error surfaces inline.
  async function handleEditSubmit(next: RequestDraft) {
    if (!token) return;
    setEditError(false);
    try {
      const updated = await updateRequest(request.id, next, token);
      onUpdated(updated);
      setEditing(false);
    } catch {
      setEditError(true);
    }
  }

  // The request's editable fields, pre-filled into the form when editing.
  const editDraft: RequestDraft = {
    recipient: request.recipient,
    occasion: request.occasion,
    neededBy: request.neededBy,
    dietary: request.dietary,
    location: request.location,
    kashrut: request.kashrut,
    aboutRecipient: request.aboutRecipient,
    contactPhone: request.contactPhone,
  };

  if (editing) {
    return (
      <li className="request-card">
        <RequestForm
          t={t}
          initial={editDraft}
          submitLabel={t.form.saveChanges}
          onSubmit={handleEditSubmit}
          onCancel={() => {
            setEditing(false);
            setEditError(false);
          }}
        />
        {editError && <p className="reserve-error">{t.list.editError}</p>}
      </li>
    );
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
        {t.list.locationPrefix} {optionLabel(t.options.area, request.location)}
      </p>
      {request.kashrut && (
        <p>
          {t.list.kashrutPrefix}{' '}
          {parseList(request.kashrut)
            .map((level) => optionLabel(t.options.kashrut, level))
            .join(', ')}
        </p>
      )}
      {request.dietary && (
        <p>
          {t.list.dietaryPrefix}{' '}
          {parseList(request.dietary)
            .map((need) => optionLabel(t.options.dietary, need))
            .join(', ')}
        </p>
      )}
      {request.aboutRecipient && (
        <p>
          {t.list.aboutRecipientPrefix} {shown.aboutRecipient}
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
          {/* Once a baker commits, they see the requester's delivery phone here
              (the server only sends it to the assigned baker / owner / admin). */}
          {(committed || delivered || received) && request.contactPhone && (
            <p className="delivery-phone">
              {t.list.deliveryPhonePrefix} {request.contactPhone}
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
          {canShareGallery && (
            <div className="gallery-share">
              <p className="gallery-share-status">
                {bothShared
                  ? t.gallery.inGallery
                  : myShared
                    ? t.gallery.waitingOther
                    : t.gallery.shareInvite}
              </p>
              <label className="gallery-caption-label">
                {t.gallery.captionLabel}
                <input
                  value={caption}
                  maxLength={200}
                  placeholder={t.gallery.captionPlaceholder}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </label>
              <div className="gallery-share-actions">
                <button
                  type="button"
                  onClick={() => saveGalleryShare(!myShared)}
                  disabled={galleryStatus === 'saving'}
                >
                  {myShared ? t.gallery.unshare : t.gallery.share}
                </button>
                {myShared && (
                  <button
                    type="button"
                    onClick={() => saveGalleryShare(true)}
                    disabled={galleryStatus === 'saving'}
                  >
                    {t.gallery.saveMessage}
                  </button>
                )}
              </div>
              {galleryStatus === 'error' && <p className="reserve-error">{t.gallery.shareError}</p>}
            </div>
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

      {request.committedAt != null && <Timeline t={t} language={language} request={request} />}

      {(canEdit || canDelete) && (
        <div className="card-actions">
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)}>
              {t.list.editRequest}
            </button>
          )}
          {canDelete && (
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
          )}
          {deleteStatus === 'error' && <p className="reserve-error">{t.list.deleteError}</p>}
        </div>
      )}
    </li>
  );
}
