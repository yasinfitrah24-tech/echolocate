// Two separate questions about the crowd, kept apart on purpose:
// - Audience age: who mostly comes. Feeds Qloo's taste data, so the groups are Qloo's own.
// - Admission: who is allowed in. Decides whether alcohol brands may be shown.
//   A 21+ bar show with a young crowd can take a beer sponsor; an all-ages
//   family festival with an older crowd should not.
//
// Safe to import from client components (no secrets, type-only Qloo import).

import type { AgeGroup } from "./qloo";

export interface AudienceAge {
  id: AgeGroup;
  label: string;
}

// Only "24_and_younger" is confirmed to change Qloo's results (tested 6 Oct).
export const AUDIENCE_AGES: readonly AudienceAge[] = [
  { id: "24_and_younger", label: "24 and younger" },
  { id: "25_to_29", label: "25 to 29" },
  { id: "30_to_34", label: "30 to 34" },
  { id: "35_to_44", label: "35 to 44" },
  { id: "45_to_54", label: "45 to 54" },
  { id: "55_and_older", label: "55 and older" },
];

export const ADMISSIONS = [
  { id: "all_ages", label: "All ages", phrase: "an all-ages show", alcoholAllowed: false },
  { id: "18_plus", label: "18+", phrase: "an 18+ show", alcoholAllowed: false },
  { id: "21_plus", label: "21+", phrase: "a 21+ show", alcoholAllowed: true },
] as const;

export type Admission = (typeof ADMISSIONS)[number];

/** Used when the organizer does not say: the safe choice, no alcohol brands. */
export const DEFAULT_ADMISSION: Admission = ADMISSIONS[0];

export function findAudienceAge(id: unknown): AudienceAge | null {
  return AUDIENCE_AGES.find((option) => option.id === id) ?? null;
}

export function findAdmission(id: unknown): Admission | null {
  return ADMISSIONS.find((option) => option.id === id) ?? null;
}
