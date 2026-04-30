import { describe, it, expect } from 'vitest';
import {
  parseProfileToml,
  injectMissingBuiltinQuestions,
  isFilled,
  getByPath,
  ProfileTomlSchema,
  type ProfileToml,
} from '../profileToml.js';
import { PROFILE_FIELDS, WOLF_BUILTIN_QUESTIONS, WOLF_BUILTIN_QUESTION_IDS } from '../profileFields.js';
import { profileTomlTemplate as profileTemplate } from '../profileTomlGenerate.js';

// `profile.toml` is the central data shape for v2 workspaces. The schema
// lives in `profileToml.ts`, the template lives in
// the generated `profileTomlTemplate` (src/utils/profileTomlGenerate.ts), and the field metadata
// for `wolf profile fields` lives in `profileFields.ts`. These tests pin
// those three artifacts in alignment so a drift in any one fails CI loud
// rather than surfacing as a runtime parse failure on a user's machine.

describe('parseProfileToml()', () => {
  // The bundled template is what `wolf init` writes verbatim into a fresh
  // workspace. Parsing it must succeed against the schema with zero zod
  // errors — anything else is a template / schema disagreement and would
  // break every `wolf init` for new users.
  it('parses the bundled wolf-init template without errors', () => {
    const parsed = parseProfileToml(profileTemplate);
    expect(parsed.schemaVersion).toBe(2);
    // Identity / contact / address tables must exist with the expected fields.
    expect(parsed.identity.legal_first_name).toBeDefined();
    expect(parsed.contact.email).toBeDefined();
    expect(parsed.address.full).toBeDefined();
  });

  // Every wolf-builtin story id must be seeded in the template (init time
  // injection). injectMissingBuiltinQuestions handles the case where wolf
  // adds a builtin LATER, but at template-write time the schema-aligned
  // bundle must already contain them all.
  it('seeds all 17 wolf-builtin story prompts in the template', () => {
    const parsed = parseProfileToml(profileTemplate);
    const seedIds = new Set(parsed.question.map((s) => s.id));
    for (const builtin of WOLF_BUILTIN_QUESTIONS) {
      expect(seedIds.has(builtin.id)).toBe(true);
    }
    // Round-trip the count too — if the template gained an extra story
    // (e.g. accidentally pasted twice), this catches it before β2 lands.
    expect(parsed.question.length).toBe(WOLF_BUILTIN_QUESTIONS.length);
  });

  // Required-flag defaults in the template must match wolf's source-of-truth.
  // If they ever disagree, doctor's "REQUIRED stories missing" output and
  // the template's pre-filled `required = true|false` lie to the user
  // about which prompts they really need to answer.
  it('story.required defaults match WOLF_BUILTIN_QUESTIONS source-of-truth', () => {
    const parsed = parseProfileToml(profileTemplate);
    const byId = new Map(parsed.question.map((s) => [s.id, s]));
    for (const builtin of WOLF_BUILTIN_QUESTIONS) {
      const story = byId.get(builtin.id);
      expect(story).toBeDefined();
      expect(story!.required).toBe(builtin.required);
    }
  });

  // Empty multiline string fields ("""\n\n""") parse to a string with
  // just a newline — NOT undefined. isFilled() collapses that to "not
  // filled" by trimming. Surface this contract here so future schema
  // tweaks can't accidentally make these `optional()` and break the
  // doctor's REQUIRED-field detection.
  it('parses empty multiline string fields as defined-but-empty strings', () => {
    const parsed = parseProfileToml(profileTemplate);
    // identity.legal_first_name is "" (between """\n\n""" the value is "\n").
    expect(typeof parsed.identity.legal_first_name).toBe('string');
    expect(isFilled(parsed.identity.legal_first_name)).toBe(false);
  });

  // Default values shipped in the template (e.g. veteran_status) must
  // survive parse — these set sensible NG defaults the user can override.
  it('preserves default values seeded in the template', () => {
    const parsed = parseProfileToml(profileTemplate);
    expect(parsed.identity.country_currently_in.trim()).toBe('United States');
    expect(parsed.demographics.veteran_status.trim()).toBe('I am not a protected veteran');
    expect(parsed.demographics.first_gen_college.trim()).toBe('No');
    // β.10f: clearance collapsed from 4 pseudo-enum fields to 1 freeform
    // `preferences` field. No defaults seeded — users write their own prose.
    // β.10g: form_answers absorbed into [[question]] array; defaults now seeded
    // via WOLF_BUILTIN_QUESTIONS.defaultAnswer at template generation.
    const byId = new Map(parsed.question.map((q) => [q.id, q]));
    // β.10j: salary_expectation default removed — fill agent computes
    // from JD's salary range at runtime. The seeded answer is empty.
    expect(byId.get('salary_expectation')!.answer.trim().length).toBe(0);
    expect(byId.get('how_did_you_hear')!.answer.trim()).toBe('LinkedIn');
    expect(byId.get('when_can_you_start')!.answer.trim()).toBe('Available immediately');
    expect(parsed.job_preferences.remote_preference.trim()).toBe('no preference');
  });

  // schemaVersion is required and must be a positive integer. Without it,
  // the migrations runtime can't decide whether to gate or upgrade.
  it('rejects a TOML missing schemaVersion', () => {
    expect(() => parseProfileToml('identity = {}')).toThrow();
  });

  // Junk schemaVersion (string, zero, negative, float) must throw rather
  // than silently parse — the migrations runner treats non-integer or
  // non-positive versions as malformed input.
  it('rejects malformed schemaVersion values', () => {
    expect(() => parseProfileToml('schemaVersion = "two"')).toThrow();
    expect(() => parseProfileToml('schemaVersion = 0')).toThrow();
    expect(() => parseProfileToml('schemaVersion = -1')).toThrow();
    // Float — z.number().int() rejects.
    expect(() => parseProfileToml('schemaVersion = 1.5')).toThrow();
  });
});

describe('injectMissingBuiltinQuestions()', () => {
  // Helper: build a minimal valid ProfileToml programmatically.
  function emptyProfile(): ProfileToml {
    return ProfileTomlSchema.parse({ schemaVersion: 2 });
  }

  // The base case: parser-generated empty profile has no stories yet,
  // so all 17 builtins are appended.
  it('adds all builtins when the story array is empty', () => {
    const profile = emptyProfile();
    const topped = injectMissingBuiltinQuestions(profile);
    expect(topped.question.length).toBe(WOLF_BUILTIN_QUESTIONS.length);
    const ids = topped.question.map((s) => s.id);
    for (const builtin of WOLF_BUILTIN_QUESTIONS) {
      expect(ids).toContain(builtin.id);
    }
  });

  // The lazy-inject case after a wolf upgrade: existing builtins are
  // preserved verbatim (including any user-filled answer), only the
  // missing ones are appended.
  it('preserves existing builtin entries and appends only missing ones', () => {
    const filled = WOLF_BUILTIN_QUESTIONS.slice(0, 3); // first three only
    const profile: ProfileToml = {
      ...emptyProfile(),
      question: filled.map((b) => ({
        id: b.id,
        prompt: b.prompt,
        required: b.required,
        answer: 'user wrote this',
        subnote: 'and this',
      })),
    };
    const topped = injectMissingBuiltinQuestions(profile);
    expect(topped.question.length).toBe(WOLF_BUILTIN_QUESTIONS.length);
    // Existing user content survives.
    expect(topped.question[0].answer).toBe('user wrote this');
    expect(topped.question[1].subnote).toBe('and this');
    // Missing builtins were appended at the end.
    const tailIds = topped.question.slice(filled.length).map((s) => s.id);
    expect(tailIds).toEqual(WOLF_BUILTIN_QUESTIONS.slice(filled.length).map((b) => b.id));
  });

  // Custom (non-builtin) stories pass through untouched. β doesn't yet
  // implement `wolf profile add story --prompt`, but if a user hand-edited
  // their TOML to add one, we mustn't throw it away on read.
  it('preserves user-custom (non-builtin) story entries', () => {
    const profile: ProfileToml = {
      ...emptyProfile(),
      question: [{
        id: 'why-interested-in-our-company',
        prompt: 'Why interested?',
        required: false,
        answer: 'because reasons',
        subnote: '',
      }],
    };
    const topped = injectMissingBuiltinQuestions(profile);
    // Custom story stays at index 0.
    expect(topped.question[0].id).toBe('why-interested-in-our-company');
    // All 17 builtins are appended after.
    expect(topped.question.length).toBe(WOLF_BUILTIN_QUESTIONS.length + 1);
    for (const builtin of WOLF_BUILTIN_QUESTIONS) {
      expect(WOLF_BUILTIN_QUESTION_IDS.has(builtin.id)).toBe(true);
    }
  });

  // Re-injecting a profile that already has every builtin is a no-op.
  // Idempotent: calling parseProfileToml twice on the same input should
  // give the same shape.
  it('is a no-op when all builtins are present', () => {
    const profile = injectMissingBuiltinQuestions(emptyProfile());
    const reInjected = injectMissingBuiltinQuestions(profile);
    expect(reInjected.question.length).toBe(profile.question.length);
    expect(reInjected.question.map((s) => s.id)).toEqual(profile.question.map((s) => s.id));
  });
});

describe('isFilled()', () => {
  // Empty / whitespace-only inputs all read as not-filled. Multiline
  // strings parse to "\n" / "\n  \n" / "\n\n\n" patterns; trim handles all.
  it('returns false for empty / whitespace-only / newline-only values', () => {
    expect(isFilled('')).toBe(false);
    expect(isFilled('   ')).toBe(false);
    expect(isFilled('\n')).toBe(false);
    expect(isFilled('\n\n')).toBe(false);
    expect(isFilled('\n   \n')).toBe(false);
    expect(isFilled('\t\t')).toBe(false);
  });

  // Anything with a non-whitespace character reads as filled, no matter
  // how short or how much surrounding whitespace.
  it('returns true for any value containing a non-whitespace character', () => {
    expect(isFilled('x')).toBe(true);
    expect(isFilled(' x ')).toBe(true);
    expect(isFilled('\nx\n')).toBe(true);
    expect(isFilled('Decline to answer')).toBe(true);
    expect(isFilled('NA')).toBe(true);
  });
});

describe('getByPath()', () => {
  it('returns top-level table.field values', () => {
    const profile = parseProfileToml(profileTemplate);
    // TOML spec: a multiline basic string `"""<newline>X<newline>"""` parses
    // with the leading newline stripped. So `"""\nUnited States\n"""` →
    // `"United States\n"`. We surface the value verbatim (consumers trim
    // when they need a clean scalar; the trailing \n itself is harmless).
    expect(getByPath(profile, 'identity.country_currently_in')).toBe('United States\n');
    expect(getByPath(profile, 'question.how_did_you_hear.answer')).toBe('LinkedIn\n');
  });

  // Three-segment paths address array-of-table members by id. Used by
  // `wolf profile get story.tell_me_about_failure.answer` etc.
  it('returns array-member fields by id', () => {
    const profile = parseProfileToml(profileTemplate);
    const v = getByPath(profile, 'question.tell_me_about_failure.prompt');
    expect(typeof v).toBe('string');
    expect((v as string).trim()).toBe('Tell me about a time you failed');
  });

  // Boolean fields (story.required) come through as booleans.
  it('returns boolean values as booleans', () => {
    const profile = parseProfileToml(profileTemplate);
    expect(getByPath(profile, 'question.tell_me_about_failure.required')).toBe(true);
    expect(getByPath(profile, 'question.why_leaving_current_role.required')).toBe(false);
  });

  // Unknown paths return undefined — `wolf profile get` translates that
  // into a "no such field" error rather than crashing.
  it('returns undefined for unknown paths', () => {
    const profile = parseProfileToml(profileTemplate);
    expect(getByPath(profile, 'identity.no_such_field')).toBeUndefined();
    expect(getByPath(profile, 'no_such_table.foo')).toBeUndefined();
    expect(getByPath(profile, 'question.no_such_id.prompt')).toBeUndefined();
    expect(getByPath(profile, 'experience.amazon-2024.bullets')).toBeUndefined(); // none in template
    expect(getByPath(profile, 'too.many.dots.here')).toBeUndefined();
    expect(getByPath(profile, 'no_dots')).toBeUndefined();
  });
});

describe('PROFILE_FIELDS alignment with profile.toml template', () => {
  // The hardcoded PROFILE_FIELDS list drives `wolf profile fields` and
  // `wolf doctor`. If a baseline path is in the template but missing
  // from PROFILE_FIELDS (or vice versa), one half of the codebase
  // disagrees with the other. This test catches the drift in CI rather
  // than at user-runtime.

  // Helper: extract baseline scalar paths (table.field) from the parsed
  // template object. We exclude:
  //   - schemaVersion (top-level key, not under a [table])
  //   - array-of-table fields (experience / project / education / story) —
  //     PROFILE_FIELDS deliberately doesn't enumerate those by id.
  function extractBaselinePathsFromParsed(profile: ProfileToml): string[] {
    const paths: string[] = [];
    const obj = profile as unknown as Record<string, unknown>;
    for (const [tableName, tableValue] of Object.entries(obj)) {
      if (tableName === 'schemaVersion') continue;
      // Skip arrays-of-table — handled separately by STORY_FIELDS / etc.
      if (Array.isArray(tableValue)) continue;
      if (typeof tableValue !== 'object' || tableValue === null) continue;
      for (const fieldName of Object.keys(tableValue as Record<string, unknown>)) {
        paths.push(`${tableName}.${fieldName}`);
      }
    }
    return paths.sort();
  }

  it('every path in PROFILE_FIELDS exists in the parsed template', () => {
    const profile = parseProfileToml(profileTemplate);
    const templatePaths = new Set(extractBaselinePathsFromParsed(profile));
    const missingFromTemplate = PROFILE_FIELDS
      .map((f) => f.path)
      .filter((p) => !templatePaths.has(p));
    expect(missingFromTemplate).toEqual([]);
  });

  it('every baseline path in the template is enumerated in PROFILE_FIELDS', () => {
    const profile = parseProfileToml(profileTemplate);
    const declaredPaths = new Set(PROFILE_FIELDS.map((f) => f.path));
    const templatePaths = extractBaselinePathsFromParsed(profile);
    const missingFromDeclaration = templatePaths.filter((p) => !declaredPaths.has(p));
    expect(missingFromDeclaration).toEqual([]);
  });
});
