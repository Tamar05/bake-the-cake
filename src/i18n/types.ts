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
  };
};
