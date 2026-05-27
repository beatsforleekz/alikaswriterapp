export type AppSettings = {
  profile: {
    displayName: string;
    email: string;
    roleTitle: string;
    defaultCompany: string;
    defaultContactEmail: string;
  };
  general: {
    defaultReviewYear: number;
    defaultSessionSort: "most_recent" | "date_oldest" | "a_z" | "z_a" | "date_added";
    dateFormat: "yyyy-mm-dd" | "dd-mm-yyyy" | "mm-dd-yyyy";
    timezone: string;
    density: "compact" | "spacious";
  };
  archive: {
    autoEvidenceStrength: boolean;
    archiveFilterDefault: "needs_review_only" | "all_sessions";
    requireBounceForStrong: boolean;
    requireLyricsForStrong: boolean;
    requireWritersSplitsForStrong: boolean;
    requireSupportingLinkForStrong: boolean;
    requireFollowUpForMissing: boolean;
  };
  sessionDefaults: {
    defaultLocationStudio: string;
    defaultAttendees: string;
    defaultFollowUpOwner: string;
    autoFollowUpMissingCoreEvidence: boolean;
  };
  writersSplits: {
    defaultEqualSplitBehavior: boolean;
    roundingRuleNote: string;
    savedWriterRoles: string;
    defaultWriterRole: string;
  };
  playlistPitching: {
    defaultPitchEmail: string;
    defaultPlaylistExpiryDays: number;
    allowRecipientResponses: boolean;
    defaultPublicFooterText: string;
  };
  audioStorage: {
    preferredUploadFormat: string;
    maxUploadWarningMb: number;
  };
  tagsCatalogue: {
    preferredTagSuggestions: string;
    statusDefinitionsNote: string;
  };
  brandPublic: {
    publicBrandName: string;
    publicFooterText: string;
    contactEmail: string;
    accentPreference: string;
  };
};

export const SETTINGS_STORAGE_KEY = "alika_app_settings_v1";

export const defaultSettings: AppSettings = {
  profile: {
    displayName: "",
    email: "",
    roleTitle: "",
    defaultCompany: "",
    defaultContactEmail: "",
  },
  general: {
    defaultReviewYear: new Date().getFullYear(),
    defaultSessionSort: "most_recent",
    dateFormat: "yyyy-mm-dd",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
    density: "spacious",
  },
  archive: {
    autoEvidenceStrength: true,
    archiveFilterDefault: "needs_review_only",
    requireBounceForStrong: true,
    requireLyricsForStrong: true,
    requireWritersSplitsForStrong: true,
    requireSupportingLinkForStrong: true,
    requireFollowUpForMissing: true,
  },
  sessionDefaults: {
    defaultLocationStudio: "",
    defaultAttendees: "",
    defaultFollowUpOwner: "",
    autoFollowUpMissingCoreEvidence: true,
  },
  writersSplits: {
    defaultEqualSplitBehavior: true,
    roundingRuleNote: "When rounding is needed, first writer receives rounded-up remainder.",
    savedWriterRoles: "Topline, Producer, Composer, Vocal, Artist",
    defaultWriterRole: "Topline",
  },
  playlistPitching: {
    defaultPitchEmail: "info@pittbuhl.com",
    defaultPlaylistExpiryDays: 14,
    allowRecipientResponses: true,
    defaultPublicFooterText: "For enquiries: info@pittbuhl.com",
  },
  audioStorage: {
    preferredUploadFormat: "mp3",
    maxUploadWarningMb: 30,
  },
  tagsCatalogue: {
    preferredTagSuggestions: "afro house, r&b, female vocal, male vocal, duet, topline, club, sync, demo, pitch ready",
    statusDefinitionsNote: "Started, Written, Bounce In, Assets Filed, Pitched, On Hold, Cut, Approved, Released, Disputed, Registered, Complete",
  },
  brandPublic: {
    publicBrandName: "Alika's Writing App",
    publicFooterText: "Private pitch material. Contact for enquiries.",
    contactEmail: "info@pittbuhl.com",
    accentPreference: "Warm Nude/Brown",
  },
};

export function mergeSettings(input: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    ...defaultSettings,
    ...(input || {}),
    profile: { ...defaultSettings.profile, ...(input?.profile || {}) },
    general: { ...defaultSettings.general, ...(input?.general || {}) },
    archive: { ...defaultSettings.archive, ...(input?.archive || {}) },
    sessionDefaults: { ...defaultSettings.sessionDefaults, ...(input?.sessionDefaults || {}) },
    writersSplits: { ...defaultSettings.writersSplits, ...(input?.writersSplits || {}) },
    playlistPitching: { ...defaultSettings.playlistPitching, ...(input?.playlistPitching || {}) },
    audioStorage: { ...defaultSettings.audioStorage, ...(input?.audioStorage || {}) },
    tagsCatalogue: { ...defaultSettings.tagsCatalogue, ...(input?.tagsCatalogue || {}) },
    brandPublic: { ...defaultSettings.brandPublic, ...(input?.brandPublic || {}) },
  };
}
