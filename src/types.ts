// The fields a person types into the request form.
export type RequestDraft = {
  recipient: string; // who the cake is for
  occasion: string; // occasion / theme, e.g. "8th birthday, dinosaurs"
  neededBy: string; // date the cake is needed, as yyyy-mm-dd
  dietary: string; // dietary needs (optional; '' when none)
  location: string; // rough location, e.g. town or postcode
};

// A saved request: everything from the draft plus an id and a timestamp.
export type CakeRequest = RequestDraft & {
  id: string;
  createdAt: number; // milliseconds since 1970, used for ordering
};
