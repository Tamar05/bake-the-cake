// The fields a person types into the request form.
export type RequestDraft = {
  recipient: string; // who the cake is for
  occasion: string; // occasion / theme, e.g. "8th birthday, dinosaurs"
  neededBy: string; // date the cake is needed, as yyyy-mm-dd
  dietary: string; // chosen dietary needs, joined with ", " (see lib/options); '' when none
  location: string; // the chosen delivery area (a value from AREAS); free text on legacy rows
  kashrut: string; // the one required kashrut level (a value from KASHRUT_OPTIONS)
  aboutRecipient: string; // optional note about who the cake is for; '' when none
  contactPhone: string; // phone the baker uses to reach the requester for delivery
};

// A saved request: everything from the draft plus an id, a timestamp, and its
// reservation state. `status` is decided by the server's reservation clock: a
// request is 'reserved' only while its 1-hour hold is still running.
export type CakeRequest = RequestDraft & {
  id: string;
  createdAt: number; // milliseconds since 1970, used for ordering
  ownerId: string | null; // the requester who posted it; null for legacy rows
  status: 'open' | 'reserved' | 'committed' | 'delivered' | 'received';
  reservedBy: string | null; // baker's name while claimed, else null
  reservedContact: string | null; // baker's phone/email while claimed, else null
  reservedByUserId: string | null; // the baker's account id while claimed, else null
  reservedUntil: number | null; // ms-since-1970 the 1-hour hold ends; null once committed
  reservedAt: number | null; // ms-since-1970 the baker first claimed it, else null
  committedAt: number | null; // ms-since-1970 the baker committed to bake, else null
  deliveredAt: number | null; // ms-since-1970 the baker marked it delivered, else null
  receivedAt: number | null; // ms-since-1970 the requester confirmed receipt, else null
  hasPhoto: boolean; // whether a finished-cake photo exists (fetched separately, privately)
  sharedByOwner: boolean; // the requester agreed to show this cake in the public gallery
  sharedByBaker: boolean; // the baker agreed to show this cake in the public gallery
  galleryCaption: string; // optional gallery message ('' if none)
};
