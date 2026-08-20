// The fields a person submits (same shape as the frontend's RequestDraft).
export type RequestDraft = {
  recipient: string;
  occasion: string;
  neededBy: string;
  dietary: string;
  location: string;
};

// A saved request: the draft plus a database id and a timestamp (ms since 1970).
export type CakeRequest = RequestDraft & {
  id: string;
  createdAt: number;
};
