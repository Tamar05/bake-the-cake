import type { Dictionary } from './types';

export const en: Dictionary = {
  appTitle: '🍰 Bake the Cake',
  tagline: 'Ask for a celebration cake, made with care by a volunteer.',
  languageLabel: 'Language',
  form: {
    heading: 'Request a cake',
    recipientLabel: 'Who is the cake for?',
    occasionLabel: 'Occasion or theme',
    neededByLabel: 'Date needed',
    dietaryLabel: 'Dietary needs (optional)',
    locationLabel: 'Rough location',
    submit: 'Submit request',
    missingFields: 'Please fill in the required fields before submitting.',
  },
  list: {
    heading: 'Open requests',
    empty: 'No requests yet. Fill in the form to add the first one.',
    neededByPrefix: 'Needed by:',
    dietaryPrefix: 'Dietary:',
    locationPrefix: 'Location:',
    loading: 'Loading requests…',
    loadError: 'Could not reach the server. Make sure the backend is running, then refresh.',
  },
};
