import { describe, it, expect } from 'vitest';
import {
  setMultilineString,
  setMultilineStringInArrayMember,
  setBoolean,
  setBooleanInArrayMember,
  appendArrayMember,
  removeArrayMember,
  TomlEditError,
} from '../tomlEdit.js';
import { parseProfileToml } from '../profileToml.js';
import { profileTomlTemplate as profileTemplate } from '../profileTomlGenerate.js';

// Surgical TOML edit drives every `wolf profile set / add / remove`. The
// reviewer flagged regex robustness as a real concern (C1) — these tests
// exercise the tricky boundaries: commented stubs, multiline values that
// look like field declarations, multiple array members, `"""` collisions.

describe('setMultilineString()', () => {
  // The simplest case: replace a top-level scalar field's value. After the
  // edit, parsing the result must yield the new value AND every other
  // field (including the comment blocks above each field) must be byte-
  // equivalent. We assert "byte equivalence" by checking specific anchors
  // before / after the edit.
  it('replaces an empty field value with new text', () => {
    const next = setMultilineString(profileTemplate, 'identity', 'legal_first_name', 'Gerry');
    const parsed = parseProfileToml(next);
    expect(parsed.identity.legal_first_name).toBe('Gerry\n');
    // Surrounding fields untouched.
    expect(parsed.identity.legal_last_name).toBe('\n'); // still empty per template
    expect(parsed.contact.email).toBe('\n');
  });

  // Pre-filled fields (e.g. veteran_status default) replace cleanly. No
  // duplication, no leftover from the old value.
  it('replaces a pre-filled field value', () => {
    const next = setMultilineString(
      profileTemplate,
      'demographics',
      'veteran_status',
      'I am a protected veteran',
    );
    const parsed = parseProfileToml(next);
    expect(parsed.demographics.veteran_status.trim()).toBe('I am a protected veteran');
    // Other defaults intact.
    expect(parsed.demographics.first_gen_college.trim()).toBe('No');
    expect(parsed.identity.country_currently_in.trim()).toBe('United States');
  });

  // Multi-line value: bullets list is the canonical use case. Newlines
  // inside the value pass through verbatim.
  it('handles a multi-line replacement value', () => {
    const value = '- Reduced API latency by 40%\n- Led TS migration\n- Wrote integration tests';
    const next = setMultilineString(profileTemplate, 'job_preferences', 'scoring_notes', value);
    const parsed = parseProfileToml(next);
    expect(parsed.job_preferences.scoring_notes.trim()).toBe(value);
  });

  // The comment block above a field MUST survive the edit — that's the
  // entire reason we don't use parse+stringify.
  it('preserves comment blocks above the edited field', () => {
    const next = setMultilineString(profileTemplate, 'contact', 'email', 'gerry@example.com');
    expect(next).toContain('# REQUIRED — Resume header & outreach From: address.');
    expect(next).toContain('gerry@example.com');
  });

  // The comment block of OTHER fields must also survive — we shouldn't
  // accidentally swallow / shift / duplicate any.
  it('preserves comment blocks of unrelated fields', () => {
    const next = setMultilineString(profileTemplate, 'contact', 'email', 'a@b');
    expect(next).toContain('# REQUIRED — Wolf cannot guess this. Used as the resume header.');
    expect(next).toContain('# OPTIONAL — Required by some non-US ATS forms; format YYYY-MM-DD.');
  });

  // Reviewer's C1 case: the `[[experience]]` template stub block is
  // commented out (`# [[experience]]`, `# job_title = """..."""`). The
  // edit must NOT match commented-out field declarations.
  it('ignores commented-out field declarations (template stubs)', () => {
    // Add a real `[[experience]]` block by appending one (we test
    // appendArrayMember separately below; here we just want a single
    // [[experience]] entry to disambiguate).
    const withEntry = appendArrayMember(profileTemplate, [
      '[[experience]]',
      'id = "amazon-2024"',
      'job_title = """',
      '',
      '"""',
      'company = """',
      'Amazon',
      '"""',
      'start = """',
      '2024-06',
      '"""',
      'end = """',
      '2024-09',
      '"""',
      'location = """',
      '',
      '"""',
      'bullets = """',
      '',
      '"""',
      'subnote = """',
      '',
      '"""',
    ].join('\n'));

    // Now edit the experience.amazon-2024.job_title — the algorithm must
    // pick the REAL `[[experience]]` we just appended, NOT the commented-
    // out stub example earlier in the file.
    const after = setMultilineStringInArrayMember(
      withEntry,
      'experience',
      'amazon-2024',
      'job_title',
      'Software Engineer Intern',
    );
    const parsed = parseProfileToml(after);
    const exp = parsed.experience.find((e) => e.id === 'amazon-2024');
    expect(exp).toBeDefined();
    expect(exp!.job_title.trim()).toBe('Software Engineer Intern');
    // Pre-existing company value untouched.
    expect(exp!.company.trim()).toBe('Amazon');
  });

  // `"""` in the new value must be rejected at the input boundary — a
  // string body terminated mid-value would corrupt the entire file.
  it('rejects values containing triple-quote', () => {
    expect(() =>
      setMultilineString(profileTemplate, 'identity', 'legal_first_name', 'has """ in it'),
    ).toThrow(TomlEditError);
    expect(() =>
      setMultilineString(profileTemplate, 'identity', 'legal_first_name', 'has """ in it'),
    ).toThrow(/triple-quote/);
  });

  // Unknown table → typed error, not a silent no-op.
  it('throws TomlEditError when the table does not exist', () => {
    expect(() =>
      setMultilineString(profileTemplate, 'no_such_table', 'foo', 'bar'),
    ).toThrow(TomlEditError);
  });

  // Unknown field on a real table → typed error.
  it('throws TomlEditError when the field does not exist on the table', () => {
    expect(() =>
      setMultilineString(profileTemplate, 'identity', 'no_such_field', 'bar'),
    ).toThrow(TomlEditError);
  });
});

describe('setMultilineStringInArrayMember()', () => {
  // Helper: append a synthetic experience entry to the template so we have
  // a real `[[experience]]` block to address by id.
  function withSyntheticExperience(id: string): string {
    return appendArrayMember(profileTemplate, [
      `[[experience]]`,
      `id = "${id}"`,
      'job_title = """',
      'Engineer',
      '"""',
      'company = """',
      'Co',
      '"""',
      'start = """',
      '2024-01',
      '"""',
      'end = """',
      '2024-06',
      '"""',
      'location = """',
      '',
      '"""',
      'bullets = """',
      '',
      '"""',
      'subnote = """',
      '',
      '"""',
    ].join('\n'));
  }

  // Two `[[experience]]` blocks coexist: the algorithm must pick the
  // member matching the supplied id, not the first one it sees.
  it('targets the array member by id, not by position', () => {
    let content = withSyntheticExperience('alpha-2023');
    content = appendArrayMember(content, [
      `[[experience]]`,
      `id = "beta-2024"`,
      'job_title = """',
      'Original',
      '"""',
      'company = """',
      'OriginalCo',
      '"""',
      'start = """',
      '2024-06',
      '"""',
      'end = """',
      '2024-09',
      '"""',
      'location = """',
      '',
      '"""',
      'bullets = """',
      '',
      '"""',
      'subnote = """',
      '',
      '"""',
    ].join('\n'));

    // Edit the SECOND entry only.
    const after = setMultilineStringInArrayMember(
      content,
      'experience',
      'beta-2024',
      'job_title',
      'NewTitle',
    );
    const parsed = parseProfileToml(after);
    const alpha = parsed.experience.find((e) => e.id === 'alpha-2023');
    const beta = parsed.experience.find((e) => e.id === 'beta-2024');
    expect(alpha!.job_title.trim()).toBe('Engineer');         // unchanged
    expect(beta!.job_title.trim()).toBe('NewTitle');          // changed
  });

  // Story array — most likely target for `wolf profile set` since stories
  // are seeded at init. Editing answer by builtin id.
  it('edits a builtin story.answer by id', () => {
    const after = setMultilineStringInArrayMember(
      profileTemplate,
      'question',
      'tell_me_about_failure',
      'answer',
      'I shipped a feature without a flag and caused a 3-hour outage.',
    );
    const parsed = parseProfileToml(after);
    const story = parsed.question.find((s) => s.id === 'tell_me_about_failure');
    expect(story!.answer.trim()).toContain('shipped a feature without a flag');
  });

  // The `id` field itself must NOT be settable — renaming via wolf profile
  // set would orphan all references to the old id.
  it('refuses to rename an array member id', () => {
    const content = withSyntheticExperience('amazon-2024');
    expect(() =>
      setMultilineStringInArrayMember(content, 'experience', 'amazon-2024', 'id', 'amazon-2025'),
    ).toThrow(/Cannot rename/);
  });

  // Unknown id → typed error.
  it('throws TomlEditError when the id does not exist', () => {
    expect(() =>
      setMultilineStringInArrayMember(
        profileTemplate,
        'experience',
        'no-such-id',
        'job_title',
        'whatever',
      ),
    ).toThrow(TomlEditError);
  });
});

describe('setBoolean / setBooleanInArrayMember', () => {
  // Top-level boolean: the schemaVersion field is numeric, but if we ever
  // add a boolean to a top-level table this is the path. For now, the
  // primary use is `[[question]] required = false` flips. Test array path.
  it('flips a boolean field on an array member', () => {
    // story.management_style.required is `false` in the template.
    const after = setBooleanInArrayMember(
      profileTemplate,
      'question',
      'management_style',
      'required',
      true,
    );
    const parsed = parseProfileToml(after);
    const story = parsed.question.find((s) => s.id === 'management_style');
    expect(story!.required).toBe(true);
    // Adjacent stories untouched.
    const failure = parsed.question.find((s) => s.id === 'tell_me_about_failure');
    expect(failure!.required).toBe(true);
  });

  // No top-level boolean exists in the template, so this only exists as a
  // shape test — the function shouldn't blow up if you try.
  it('throws for unknown table on top-level setBoolean', () => {
    expect(() => setBoolean(profileTemplate, 'no_such_table', 'foo', true)).toThrow(TomlEditError);
  });
});

describe('appendArrayMember()', () => {
  // Appending leaves the original content intact and adds a clean newline-
  // separated block at EOF.
  it('appends a new block separated by a blank line', () => {
    const block = '[[experience]]\nid = "x"\njob_title = """\nA\n"""';
    const next = appendArrayMember(profileTemplate, block);
    expect(next).toContain('[[experience]]\nid = "x"');
    // Original last-line content of the template is preserved.
    expect(next).toContain('subnote = """');
  });

  // After appending, parsing succeeds AND the new entry is in the array.
  it('produces parseable output with the new entry', () => {
    const block = [
      '[[experience]]',
      'id = "test-1"',
      'job_title = """',
      'Tester',
      '"""',
      'company = """',
      'TestCo',
      '"""',
      'start = """',
      '2024-01',
      '"""',
      'end = """',
      'Present',
      '"""',
      'location = """',
      '',
      '"""',
      'bullets = """',
      '',
      '"""',
      'subnote = """',
      '',
      '"""',
    ].join('\n');
    const next = appendArrayMember(profileTemplate, block);
    const parsed = parseProfileToml(next);
    const entry = parsed.experience.find((e) => e.id === 'test-1');
    expect(entry).toBeDefined();
    expect(entry!.company.trim()).toBe('TestCo');
  });
});

describe('removeArrayMember()', () => {
  // Helper from earlier: append + then remove should produce content
  // that parses to the same experience array as before the append.
  function withSyntheticExperience(id: string): string {
    return appendArrayMember(profileTemplate, [
      `[[experience]]`,
      `id = "${id}"`,
      'job_title = """',
      'Engineer',
      '"""',
      'company = """',
      'Co',
      '"""',
      'start = """',
      '2024-01',
      '"""',
      'end = """',
      '2024-06',
      '"""',
      'location = """',
      '',
      '"""',
      'bullets = """',
      '',
      '"""',
      'subnote = """',
      '',
      '"""',
    ].join('\n'));
  }

  it('removes an array member by id', () => {
    const withEntry = withSyntheticExperience('to-remove');
    const removed = removeArrayMember(withEntry, 'experience', 'to-remove');
    const parsed = parseProfileToml(removed);
    expect(parsed.experience.find((e) => e.id === 'to-remove')).toBeUndefined();
  });

  // Removing a non-existent member is an error, not a silent no-op.
  it('throws TomlEditError when the member does not exist', () => {
    expect(() =>
      removeArrayMember(profileTemplate, 'experience', 'never-existed'),
    ).toThrow(TomlEditError);
  });

  // Removing one of two members leaves the OTHER one intact.
  it('preserves the remaining members after removal', () => {
    let content = withSyntheticExperience('keep-me');
    content = appendArrayMember(content, [
      `[[experience]]`,
      `id = "remove-me"`,
      'job_title = """',
      'Other',
      '"""',
      'company = """',
      'OtherCo',
      '"""',
      'start = """',
      '2024-06',
      '"""',
      'end = """',
      '2024-09',
      '"""',
      'location = """',
      '',
      '"""',
      'bullets = """',
      '',
      '"""',
      'subnote = """',
      '',
      '"""',
    ].join('\n'));

    const after = removeArrayMember(content, 'experience', 'remove-me');
    const parsed = parseProfileToml(after);
    const keep = parsed.experience.find((e) => e.id === 'keep-me');
    expect(keep).toBeDefined();
    expect(parsed.experience.find((e) => e.id === 'remove-me')).toBeUndefined();
  });

  // Removing a builtin story is the wolf-disallowed path. This function
  // accepts any id; the CLI command layer is where "you can't delete a
  // builtin" gets enforced. Test the raw function still works mechanically.
  it('mechanically removes any matching id (CLI layer enforces builtin protection)', () => {
    const after = removeArrayMember(profileTemplate, 'question', 'tell_me_about_failure');
    const parsed = parseProfileToml(after);
    // Lazy-inject re-adds the missing builtin on parse — verify by
    // checking the parsed story exists (re-injected) but its answer
    // is empty (just-injected stub state).
    const story = parsed.question.find((s) => s.id === 'tell_me_about_failure');
    expect(story).toBeDefined();
    expect(story!.answer.trim()).toBe('');
  });
});
