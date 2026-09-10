import { AREAS, DIETARY_OPTIONS, KASHRUT_OPTIONS } from '../lib/options';

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
    dietaryLabel: string; // "Dietary needs (choose any)" — the multi-select heading
    locationLabel: string; // "Area" — the delivery-area dropdown
    kashrutLabel: string; // "Kashrut needed" — the kashrut dropdown
    aboutRecipientLabel: string; // "About the recipient (optional)"
    aboutRecipientHint: string; // why the note helps the baker
    selectPlaceholder: string; // the empty "Choose…" option in a dropdown
    contactPhoneLabel: string; // phone the baker uses to reach the requester
    contactPhoneHint: string; // why the phone is needed
    submit: string;
    saveChanges: string; // submit label when editing an existing request
    cancelEdit: string; // cancels an in-progress edit
    missingFields: string; // gentle message when required fields are blank
    invalidPhone: string; // shown when the contact phone isn't a real number
    signInToPost: string; // shown instead of the form when you can't post
  };
  list: {
    heading: string;
    empty: string; // shown when there are no requests yet
    neededByPrefix: string;
    dietaryPrefix: string;
    locationPrefix: string;
    kashrutPrefix: string; // precedes the required kashrut on a card
    aboutRecipientPrefix: string; // precedes the recipient note on a card
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
    removePhoto: string; // admin moderation: remove a photo
    removingPhoto: string; // busy label while removing
    removePhotoError: string; // shown when removing a photo fails
    confirmRemovePhoto: string; // confirm prompt before an admin removes a photo
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
    deliveryPhonePrefix: string; // precedes the requester's delivery phone (shown to the baker once committed)
    timeLeftPrefix: string; // precedes the countdown
    release: string; // cancel a reservation
    releasing: string; // busy label while releasing
    releaseError: string; // shown when releasing fails
    filterAll: string; // browse filter: show every request
    filterOpen: string; // browse filter: only open requests
    filterReserved: string; // browse filter: only reserved requests
    filterEmpty: string; // shown when no request matches the chosen filter
    editRequest: string; // owner action: edit your own still-open request
    editError: string; // shown when saving an edit fails
    cancelRequest: string; // owner action: withdraw your own request
    deleteRequest: string; // admin action: remove any request
    deleting: string; // busy label while deleting
    deleteError: string; // shown when a delete fails
    confirmCancel: string; // confirm prompt before an owner cancels
    confirmDelete: string; // confirm prompt before an admin deletes
    pendingVerification: string; // shown to an unverified baker in place of Reserve
  };
  timeline: {
    heading: string; // "This cake's journey"
    posted: string;
    reserved: string;
    baking: string;
    delivered: string;
    received: string;
  };
  nav: {
    browse: string; // link to the open-requests browse view
    myRequests: string; // requester's own requests
    myReservations: string; // baker's reservations
    admin: string; // admin's manage-everything view
    bakers: string; // admin's baker-verification screen
    attention: string; // admin's needs-attention screen
    dashboard: string; // admin's stats dashboard
    gallery: string; // the public inspiration gallery
    notifications: string; // baker's notification settings
    signInPrompt: string; // gentle nudge shown to signed-out browsers
    join: string; // link to the /join page, shown to signed-out visitors
    inviteCodes: string; // admin's invite-code management screen
  };
  notifications: {
    heading: string;
    intro: string; // short explainer under the heading
    loading: string;
    loadError: string;
    enableLabel: string; // "Notify me about new requests"
    areasLabel: string; // "Areas you deliver to"
    dietaryLabel: string; // "Dietary needs you can make"
    kashrutLabel: string; // "Kashrut levels you cook with"
    save: string;
    saving: string; // busy label while saving
    saved: string; // confirmation after a save
    saveError: string; // shown when saving fails
    bellTitle: string; // accessible label on the header bell button
    bellHeading: string; // heading at the top of the bell panel
    bellEmpty: string; // shown in the panel when there are no new requests
    bellSettingsHint: string; // link in the panel to the notification settings
    // Per-device web push (get notified when the app is closed).
    push: {
      heading: string; // section heading for the on-this-device toggle
      intro: string; // one line explaining what push does
      enable: string; // button: turn push on for this device
      disable: string; // button: turn push off for this device
      working: string; // busy label while enabling/disabling
      enabled: string; // shown when this device is subscribed
      unsupported: string; // this browser can't do push
      denied: string; // the browser blocked notifications
      error: string; // generic failure enabling/disabling
    };
  };
  gallery: {
    heading: string;
    intro: string; // short line under the gallery heading
    loading: string;
    loadError: string;
    empty: string; // no cakes shared yet
    shareInvite: string; // card: prompt to share your finished cake
    inGallery: string; // card: both agreed, it's live
    waitingOther: string; // card: you agreed, waiting for the other person
    captionLabel: string; // card: label for the caption input
    captionPlaceholder: string; // card: caption placeholder
    share: string; // card: add to gallery button
    unshare: string; // card: remove from gallery button
    saveMessage: string; // card: save an edited caption
    shareError: string; // card: shown when sharing fails
  };
  dashboard: {
    heading: string;
    loading: string;
    loadError: string;
    total: string; // total requests
    open: string;
    reserved: string;
    baking: string; // committed / being baked
    delivered: string;
    fulfilled: string; // received
    needsAttention: string;
    bakers: string;
    verifiedSuffix: string; // e.g. "verified" → "3 verified"
  };
  attention: {
    heading: string;
    empty: string; // nothing needs attention
    loading: string;
    loadError: string;
    reasonOverdue: string; // badge: past its needed-by date
    reasonUnclaimed: string; // badge: open with no baker too long
    contactPrefix: string; // precedes the requester's contact
    noContact: string; // shown when the requester left no contact
  };
  bakers: {
    heading: string;
    empty: string; // no bakers signed up yet
    loading: string;
    loadError: string;
    verifiedLabel: string; // status: verified
    unverifiedLabel: string; // status: not verified
    verify: string; // button to verify
    unverify: string; // button to unverify
    working: string; // busy label
    contactPrefix: string; // precedes a baker's contact
    actionError: string; // shown when verify/unverify fails
  };
  views: {
    myRequestsHeading: string;
    myRequestsEmpty: string; // requester has posted nothing yet
    myReservationsHeading: string;
    myReservationsEmpty: string; // baker has reserved nothing yet
    adminHeading: string; // admin's list of every request
  };
  // The coordinator view on "My requests": a search box, status tabs with live
  // counts, and an overdue/due-soon flag — for an owner managing many requests
  // for different beneficiaries rather than just one.
  myRequests: {
    searchLabel: string; // accessible label for the search box
    searchPlaceholder: string;
    tabAll: string;
    tabOpen: string;
    tabInProgress: string; // reserved, committed, or delivered
    tabDone: string; // received
    tallyRequests: string; // e.g. "requests" in "12 requests"
    tallyOpen: string; // e.g. "open" in "5 open"
    tallyInProgress: string; // e.g. "in progress" in "4 in progress"
    tallyDone: string; // e.g. "delivered" in "3 delivered"
    dueOverdue: string; // flag: past its needed-by date
    dueSoon: string; // flag: needed within the next couple of days
  };
  auth: {
    signInHeading: string;
    signUpHeading: string;
    emailLabel: string;
    passwordLabel: string;
    showPassword: string; // accessible label for the reveal-password toggle
    passwordHint: string; // grey helper under the password box at sign-up; turns red when invalid
    hidePassword: string; // accessible label when the password is visible
    nameLabel: string;
    contactLabel: string;
    contactHint: string; // why bakers give a contact
    contactInvalid: string; // live error when the contact is neither a valid phone nor email
    bakerCapabilitiesHeading: string; // prompt above the baker capability pickers at sign-up
    bakerCapabilitiesNote: string; // smaller sub-note: you can change these later
    signInButton: string;
    signUpButton: string;
    needAccount: string; // switch to the sign-up form
    haveAccount: string; // switch to the sign-in form
    signOut: string;
    signedInAs: string; // precedes the name + role
    working: string; // busy label while signing in/up
    notConfigured: string; // shown when Supabase keys are missing
    genericError: string; // fallback when sign-in/up fails
    joinPrompt: string; // small line under sign-up pointing an organization to /join
    checkEmail: string; // shown after sign-up when email confirmation is required
  };
  // The /join page: an existing invite code turns a fresh account into an
  // organization ("requester"). Signs up like any baker, then redeems the code.
  join: {
    heading: string;
    intro: string; // explains what this page is for
    orgNameLabel: string;
    codeLabel: string;
    codeHint: string; // where to get a code
    submit: string;
    working: string; // busy label
    signedInIntro: string; // shown instead of the sign-up fields once already signed in
    success: string; // confirmation after redeeming
    invalidCode: string; // generic failure message (never distinguishes why)
    missingFields: string; // org name / code left blank
  };
  // Admin-only screen to create, list, and revoke invite codes.
  inviteCodes: {
    heading: string;
    intro: string;
    loading: string;
    loadError: string;
    empty: string;
    noteLabel: string;
    notePlaceholder: string;
    create: string;
    creating: string;
    createError: string;
    codeLabel: string; // precedes the code value on a row
    createdPrefix: string; // precedes the created date
    activeLabel: string;
    revokedLabel: string;
    revoke: string;
    revoking: string;
    revokeError: string;
    confirmRevoke: string; // confirm prompt before revoking
  };
  // Per-language display labels for the shared option values (the DB stores the
  // canonical value; these translate it for the reader). Typed against the
  // option lists themselves, so the compiler requires every value be translated
  // in both languages — a missing label won't build.
  options: {
    area: Record<(typeof AREAS)[number], string>;
    dietary: Record<(typeof DIETARY_OPTIONS)[number], string>;
    kashrut: Record<(typeof KASHRUT_OPTIONS)[number], string>;
  };
  // The "install the app to continue" screen shown to phone visitors who open the
  // site in a browser instead of the installed app.
  install: {
    title: string;
    lead: string; // one line on why to install
    installButton: string; // one-tap install (Android/desktop Chrome)
    continueInBrowser: string; // dismiss the nudge and use the site in the browser
    continueNote: string; // reminder that browser users miss push notifications
    stepsHeading: string; // "How to install:"
    iosStep1: string;
    iosStep2: string;
    iosStep3: string;
    iosStep4: string;
    androidStep1: string;
    androidStep2: string;
    safariNotice: string; // iOS in a non-Safari browser
    inAppNotice: string; // opened inside another app's browser
    alreadyInstalled: string; // reassurance for those who've installed already
  };
};
