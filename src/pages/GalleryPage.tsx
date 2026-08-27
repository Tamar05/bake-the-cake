import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import { getGallery, type GalleryItem } from '../lib/galleryApi';

type Status = 'loading' | 'ready' | 'error';

// The public inspiration gallery — finished cakes both the requester and baker
// chose to share. No login, and never any names, location, or contact.
export default function GalleryPage({ t }: { t: Dictionary }) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    getGallery()
      .then((list) => {
        setItems(list);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <section className="request-list">
      <h2>{t.gallery.heading}</h2>
      <p className="gallery-intro">{t.gallery.intro}</p>
      {status === 'loading' && <p className="list-status">{t.gallery.loading}</p>}
      {status === 'error' && <p className="list-status list-error">{t.gallery.loadError}</p>}
      {status === 'ready' &&
        (items.length === 0 ? (
          <p className="empty">{t.gallery.empty}</p>
        ) : (
          <div className="gallery-grid">
            {items.map((item) => (
              <figure key={item.id} className="gallery-item">
                <img src={item.photoUrl} alt={t.list.photoAlt} />
                {item.caption && <figcaption>{item.caption}</figcaption>}
              </figure>
            ))}
          </div>
        ))}
    </section>
  );
}
