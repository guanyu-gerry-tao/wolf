/**
 * Display helpers for the split UserProfile name fields.
 *
 * Profile stores name in five fields (legal first/middle/last + preferred + pronouns)
 * so ATS forms can fill First/Middle/Last separately. These helpers compose the
 * common rendering shapes — use them everywhere instead of touching the raw fields.
 */
import type { UserProfile } from '../types/index.js';

// Display name = the candidate's everyday name (resume header, cover-letter
// salutation, outreach signature). Prefers `preferredName` when set, falls back
// to `legalFirstName`. Middle name is omitted on purpose — display contexts
// almost never want it.
export function displayName(p: UserProfile): string {
  const first = p.preferredName ?? p.legalFirstName;
  return `${first} ${p.legalLastName}`.trim();
}

// Legal full name = exactly what the candidate would write on a passport / I-9.
// Includes middle name if present. Used for legal sections of ATS forms or
// any place that explicitly asks for "full legal name".
export function legalFullName(p: UserProfile): string {
  const middle = p.legalMiddleName ? ` ${p.legalMiddleName}` : '';
  return `${p.legalFirstName}${middle} ${p.legalLastName}`.trim();
}
