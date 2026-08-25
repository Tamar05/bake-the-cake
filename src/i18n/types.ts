// The shape every language dictionary must fill in. If a new piece of text
// is added here, both en.ts and he.ts must provide it (the test enforces this).
export type Dictionary = {
  appTitle: string;
  tagline: string;
  languageLabel: string; // accessible label for the language switch
  form: {
    heading: string;
    recipientLabel: string;
    occasionLabel: string;
    neededByLabel: string;
    dietaryLabel: string;
    locationLabel: string;
    submit: string;
    missingFields: string; // gentle message when required fields are blank
  };
  list: {
    heading: string;
    empty: string; // shown when there are no requests yet
    neededByPrefix: string;
    dietaryPrefix: string;
    locationPrefix: string;
    loading: string; // shown while requests are being fetched
    loadError: string; // shown when the server can't be reached
    translate: string; // Translate button label
    showOriginal: string; // toggle-back label
    translating: string; // busy label while a translation is in flight
    translateError: string; // shown when a translation fails
    statusOpen: string; // badge on an open request
    statusReserved: string; // badge on a reserved request
    reserve: string; // button that opens the reserve form
    reserveNameLabel: string; // baker's name field
    reserveContactLabel: string; // baker's contact field
    reserveConfirm: string; // submit the reservation
    reserveCancel: string; // close the reserve form without reserving
    reserving: string; // busy label while reserving
    reserveError: string; // shown when reserving fails
    reserveMissing: string; // shown when name/contact are blank
    reservedByPrefix: string; // precedes the baker's name
    reservedContactPrefix: string; // precedes the baker's contact
    timeLeftPrefix: string; // precedes the countdown
    release: string; // cancel a reservation
    releasing: string; // busy label while releasing
    releaseError: string; // shown when releasing fails
    filterAll: string; // browse filter: show every request
    filterOpen: string; // browse filter: only open requests
    filterReserved: string; // browse filter: only reserved requests
    filterEmpty: string; // shown when no request matches the chosen filter
  };
};
