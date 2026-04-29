import { describe, it, expect } from 'vitest';
import {
  parseProfileToml,
  injectMissingBuiltinStories,
  isFilled,
  getByPath,
  ProfileTomlSchema,
  type ProfileToml,
} from '../profileToml.js';
import { WOLF_BUILTIN_STORIES, WOLF_BUILTIN_STORY_IDS } from '../storyFields.js';
import { PROFILE_FIELDS } from '../profileFields.js';
import profileTemplate from '../../application/impl/templates/profile.toml';

// `profile.toml` is the central data shape for v2 workspaces. The schema
// lives in `profileToml.ts`, the template lives in
// `src/application/impl/templates/profile.toml`, and the field metadata
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
  // injection). injectMissingBuiltinStories handles the case where wolf
  // adds a builtin LATER, but at template-write time the schema-aligned
  // bundle must already contain them all.
  it('seeds all 17 wolf-builtin story prompts in the template', () => {
    const parsed = parseProfileToml(profileTemplate);
    const seedIds = new Set(parsed.story.map((s) => s.id));
    for (const builtin of WOLF_BUILTIN_STORIES) {
      expect(seedIds.has(builtin.id)).toBe(true);
    }
    // Round-trip the count too — if the template gained an extra story
    // (e.g. accidentally pasted twice), this catches it before β2 lands.
    expect(parsed.story.length).toBe(WOLF_BUILTIN_STORIES.length);
  });

  // Required-flag defaults in the template must match wolf's source-of-truth.
  // If they ever disagree, doctor's "REQUIRED stories missing" output and
  // the template's pre-filled `required = true|false` lie to the user
  // about which prompts they really need to answer.
  it('story.required defaults match WOLF_BUILTIN_STORIES source-of-truth', () => {
    const parsed = parseProfileToml(profileTemplate);
    const byId = new Map(parsed.story.map((s) => [s.id, s]));
    for (const builtin of WOLF_BUILTIN_STORIES) {
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
    expect(parsed.clearance.has_active.trim()).toBe('No');
    expect(parsed.clearance.willing_to_obtain.trim()).toBe('Yes');
    expect(parsed.form_answers.salary_expectation.trim().length).toBeGreaterThan(0);
    expect(parsed.form_answers.how_did_you_hear.trim()).toBe('LinkedIn');
    expect(parsed.form_answers.when_can_you_start.trim()).toBe('Available immediately');
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

describe('injectMissingBuiltinStories()', () => {
  // Helper: build a minimal valid ProfileToml programmatically.
  function emptyProfile(): ProfileToml {
    return ProfileTomlSchema.parse({ schemaVersion: 2 });
  }

  // The base case: parser-generated empty profile has no stories yet,
  // so all 17 builtins are appended.
  it('adds all builtins when the story array is empty', () => {
    const profile = emptyProfile();
    const topped = injectMissingBuiltinStories(profile);
    expect(topped.story.length).toBe(WOLF_BUILTIN_STORIES.length);
    const ids = topped.story.map((s) => s.id);
    for (const builtin of WOLF_BUILTIN_STORIES) {
      expect(ids).toContain(builtin.id);
    }
  });

  // The lazy-inject case after a wolf upgrade: existing builtins are
  // preserved verbatim (including any user-filled star_story), only the
  // missing ones are appended.
  it('preserves existing builtin entries and appends only missing ones', () => {
    const filled = WOLF_BUILTIN_STORIES.slice(0, 3); // first three only
    const profile: ProfileToml = {
      ...emptyProfile(),
      story: filled.map((b) => ({
        id: b.id,
        prompt: b.prompt,
        required: b.required,
        star_story: 'user wrote this',
        subnote: 'and this',
      })),
    };
    const topped = injectMissingBuiltinStories(profile);
    expect(topped.story.length).toBe(WOLF_BUILTIN_STORIES.length);
    // Existing user content survives.
    expect(topped.story[0].star_story).toBe('user wrote this');
    expect(topped.story[1].subnote).toBe('and this');
    // Missing builtins were appended at the end.
    const tailIds = topped.story.slice(filled.length).map((s) => s.id);
    expect(tailIds).toEqual(WOLF_BUILTIN_STORIES.slice(filled.length).map((b) => b.id));
  });

  // Custom (non-builtin) stories pass through untouched. β doesn't yet
  // implement `wolf profile add story --prompt`, but if a user hand-edited
  // their TOML to add one, we mustn't throw it away on read.
  it('preserves user-custom (non-builtin) story entries', () => {
    const profile: ProfileToml = {
      ...emptyProfile(),
      story: [{
        id: 'why-interested-in-our-company',
        prompt: 'Why interested?',
        required: false,
        star_story: 'because reasons',
        subnote: '',
      }],
    };
    const topped = injectMissingBuiltinStories(profile);
    // Custom story stays at index 0.
    expect(topped.story[0].id).toBe('why-interested-in-our-company');
    // All 17 builtins are appended after.
    expect(topped.story.length).toBe(WOLF_BUILTIN_STORIES.length + 1);
    for (const builtin of WOLF_BUILTIN_STORIES) {
      expect(WOLF_BUILTIN_STORY_IDS.has(builtin.id)).toBe(true);
    }
  });

  // Re-injecting a profile that already has every builtin is a no-op.
  // Idempotent: calling parseProfileToml twice on the same input should
  // give the same shape.
  it('is a no-op when all builtins are present', () => {
    const profile = injectMissingBuiltinStories(emptyProfile());
    const reInjected = injectMissingBuiltinStories(profile);
    expect(reInjected.story.length).toBe(profile.story.length);
    expect(reInjected.story.map((s) => s.id)).toEqual(profile.story.map((s) => s.id));
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
    expect(getByPath(profile, 'form_answers.how_did_you_hear')).toBe('LinkedIn\n');
  });

  // Three-segment paths address array-of-table members by id. Used by
  // `wolf profile get story.tell_me_about_failure.star_story` etc.
  it('returns array-member fields by id', () => {
    const profile = parseProfileToml(profileTemplate);
    const v = getByPath(profile, 'story.tell_me_about_failure.prompt');
    expect(typeof v).toBe('string');
    expect((v as string).trim()).toBe('Tell me about a time you failed');
  });

  // Boolean fields (story.required) come through as booleans.
  it('returns boolean values as booleans', () => {
    const profile = parseProfileToml(profileTemplate);
    expect(getByPath(profile, 'story.tell_me_about_failure.required')).toBe(true);
    expect(getByPath(profile, 'story.why_leaving_current_role.required')).toBe(false);
  });

  // Unknown paths return undefined — `wolf profile get` translates that
  // into a "no such field" error rather than crashing.
  it('returns undefined for unknown paths', () => {
    const profile = parseProfileToml(profileTemplate);
    expect(getByPath(profile, 'identity.no_such_field')).toBeUndefined();
    expect(getByPath(profile, 'no_such_table.foo')).toBeUndefined();
    expect(getByPath(profile, 'story.no_such_id.prompt')).toBeUndefined();
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
