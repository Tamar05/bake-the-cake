// The shape every language dictionary must fill in. If a new piece of text
// is added here, both en.ts and he.ts must provide it (the test enforces this).
export type Dictionary = {
  appTitle: string;
  tagline: string;
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
  };
};
