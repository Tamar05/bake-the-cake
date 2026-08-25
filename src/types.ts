// The fields a person types into the request form.
export type RequestDraft = {
  recipient: string; // who the cake is for
  occasion: string; // occasion / theme, e.g. "8th birthday, dinosaurs"
  neededBy: string; // date the cake is needed, as yyyy-mm-dd
  dietary: string; // dietary needs (optional; '' when none)
  location: string; // rough location, e.g. town or postcode
};

// A saved request: everything from the draft plus an id, a timestamp, and its
// reservation state. `status` is decided by the server's reservation clock: a
// request is 'reserved' only while its 1-hour hold is still running.
export type CakeRequest = RequestDraft & {
  id: string;
  createdAt: number; // milliseconds since 1970, used for ordering
  status: 'open' | 'reserved';
  reservedBy: string | null; // baker's name while reserved, else null
  reservedContact: string | null; // baker's phone/email while reserved, else null
  reservedUntil: number | null; // ms-since-1970 the hold ends, else null
};
