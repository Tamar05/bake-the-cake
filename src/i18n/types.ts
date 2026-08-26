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
    signInToPost: string; // shown instead of the form when you can't post
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
    statusBaking: string; // badge on a committed (being-baked) request
    statusDelivered: string; // badge on a delivered request
    statusReceived: string; // badge on a received (completed) request
    commit: string; // baker's "I'll bake this" button
    committing: string; // busy label while committing
    commitError: string; // shown when committing fails
    bakingNote: string; // note on a committed card ("a baker is making this now")
    markDelivered: string; // baker's "mark delivered" button
    delivering: string; // busy label while marking delivered
    deliverError: string; // shown when marking delivered fails
    addPhoto: string; // label above the optional photo picker at delivery
    photoPrivacyHint: string; // clarifies the delivery photo is private, not public
    photoAlt: string; // alt text for the finished-cake photo
    deliveredNote: string; // note on a delivered card (awaiting confirmation)
    confirmReceived: string; // requester's "confirm received" button
    confirming: string; // busy label while confirming receipt
    receiveError: string; // shown when confirming receipt fails
    receivedNote: string; // note on a received (completed) card
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
    cancelRequest: string; // owner action: withdraw your own request
    deleteRequest: string; // admin action: remove any request
    deleting: string; // busy label while deleting
    deleteError: string; // shown when a delete fails
    confirmCancel: string; // confirm prompt before an owner cancels
    confirmDelete: string; // confirm prompt before an admin deletes
  };
  nav: {
    browse: string; // link to the open-requests browse view
    myRequests: string; // requester's own requests
    myReservations: string; // baker's reservations
    admin: string; // admin's manage-everything view
    signInPrompt: string; // gentle nudge shown to signed-out browsers
  };
  views: {
    myRequestsHeading: string;
    myRequestsEmpty: string; // requester has posted nothing yet
    myReservationsHeading: string;
    myReservationsEmpty: string; // baker has reserved nothing yet
    adminHeading: string; // admin's list of every request
  };
  auth: {
    signInHeading: string;
    signUpHeading: string;
    emailLabel: string;
    passwordLabel: string;
    nameLabel: string;
    roleLabel: string;
    roleRequester: string; // "I need a cake"
    roleBaker: string; // "I want to bake"
    contactLabel: string;
    contactHint: string; // why bakers give a contact
    signInButton: string;
    signUpButton: string;
    needAccount: string; // switch to the sign-up form
    haveAccount: string; // switch to the sign-in form
    signOut: string;
    signedInAs: string; // precedes the name + role
    working: string; // busy label while signing in/up
    notConfigured: string; // shown when Supabase keys are missing
    genericError: string; // fallback when sign-in/up fails
  };
};
