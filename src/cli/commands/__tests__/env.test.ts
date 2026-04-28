import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeWolfBlock, envSetOne } from '../env.js';

let tmpDir: string;
let rcFile: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wolf-env-test-'));
  rcFile = path.join(tmpDir, '.zshrc');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('writeWolfBlock', () => {
  it('creates the RC file with a commented block if it does not exist', async () => {
    await writeWolfBlock(rcFile, [
      { key: 'WOLF_ANTHROPIC_API_KEY', value: 'sk-test' },
    ]);

    const content = await fs.readFile(rcFile, 'utf-8');
    expect(content).toContain('# wolf API keys');
    expect(content).toContain('export WOLF_ANTHROPIC_API_KEY=sk-test');
  });

  it('appends a blank line before the block and after', async () => {
    await fs.writeFile(rcFile, 'export PATH=/usr/bin\n', 'utf-8');

    await writeWolfBlock(rcFile, [
      { key: 'WOLF_ANTHROPIC_API_KEY', value: 'sk-test' },
    ]);

    const content = await fs.readFile(rcFile, 'utf-8');
    // The block should be separated from existing content
    expect(content).toContain('\n\n# wolf API keys\n');
    expect(content.endsWith('\n')).toBe(true);
  });

  it('updates an existing key in-place without duplicating it', async () => {
    await fs.writeFile(rcFile, '# wolf API keys\nexport WOLF_ANTHROPIC_API_KEY=old-key\n', 'utf-8');

    await writeWolfBlock(rcFile, [
      { key: 'WOLF_ANTHROPIC_API_KEY', value: 'new-key' },
    ]);

    const content = await fs.readFile(rcFile, 'utf-8');
    expect(content).toContain('export WOLF_ANTHROPIC_API_KEY=new-key');
    expect(content).not.toContain('old-key');
    // Should not duplicate the key
    const occurrences = (content.match(/WOLF_ANTHROPIC_API_KEY/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('appends only new keys, updates existing ones', async () => {
    await fs.writeFile(rcFile, '# wolf API keys\nexport WOLF_ANTHROPIC_API_KEY=existing\n', 'utf-8');

    await writeWolfBlock(rcFile, [
      { key: 'WOLF_ANTHROPIC_API_KEY', value: 'updated' },
      { key: 'WOLF_APIFY_API_TOKEN', value: 'apify-new' },
    ]);

    const content = await fs.readFile(rcFile, 'utf-8');
    expect(content).toContain('export WOLF_ANTHROPIC_API_KEY=updated');
    expect(content).toContain('export WOLF_APIFY_API_TOKEN=apify-new');
    expect(content).not.toContain('existing');
  });

  it('writes all 4 keys in a single block', async () => {
    await writeWolfBlock(rcFile, [
      { key: 'WOLF_ANTHROPIC_API_KEY', value: 'k1' },
      { key: 'WOLF_APIFY_API_TOKEN', value: 'k2' },
      { key: 'WOLF_GMAIL_CLIENT_ID', value: 'k3' },
      { key: 'WOLF_GMAIL_CLIENT_SECRET', value: 'k4' },
    ]);

    const content = await fs.readFile(rcFile, 'utf-8');
    // Only one comment header
    const headers = (content.match(/# wolf API keys/g) ?? []).length;
    expect(headers).toBe(1);
    expect(content).toContain('export WOLF_ANTHROPIC_API_KEY=k1');
    expect(content).toContain('export WOLF_APIFY_API_TOKEN=k2');
    expect(content).toContain('export WOLF_GMAIL_CLIENT_ID=k3');
    expect(content).toContain('export WOLF_GMAIL_CLIENT_SECRET=k4');
  });
});

// envSetOne is the non-interactive entry point used by
// `wolf env set <key> <value>`. These tests pin its contract: write the value
// for valid keys, reject unknown keys / empty values, trim whitespace, and
// update an existing entry in place rather than duplicating it.
describe('envSetOne', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Tests must not pollute the real terminal output; silence the helpful
    // "written to <rc>" banner that envSetOne prints on success and any error
    // message it prints on failure.
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Each test starts from a clean exit code so we can assert non-zero on
    // the failure paths without leakage between tests.
    process.exitCode = 0;
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    process.exitCode = 0;
  });

  // Happy path: a valid key+value lands in the RC file as a proper export
  // line, and the process exit code stays 0.
  it('writes a valid key+value to the rc file and leaves exitCode 0', async () => {
    await envSetOne('WOLF_ANTHROPIC_API_KEY', 'sk-ant-fresh', rcFile);

    const content = await fs.readFile(rcFile, 'utf-8');
    expect(content).toContain('export WOLF_ANTHROPIC_API_KEY=sk-ant-fresh');
    expect(process.exitCode).toBe(0);
  });

  // Defensive: surrounding whitespace from a copy-pasted value should be
  // stripped before the value lands in the RC file.
  it('trims surrounding whitespace from the value', async () => {
    await envSetOne('WOLF_APIFY_API_TOKEN', '   apify-token   ', rcFile);

    const content = await fs.readFile(rcFile, 'utf-8');
    expect(content).toContain('export WOLF_APIFY_API_TOKEN=apify-token');
    // The leading whitespace must not survive into the export line.
    expect(content).not.toMatch(/=\s+apify-token/);
  });

  // Verifies envSetOne reuses writeWolfBlock's in-place update path: setting
  // the same key a second time must replace, not duplicate.
  it('updates an existing key in place instead of appending', async () => {
    await fs.writeFile(rcFile, '# wolf API keys\nexport WOLF_ANTHROPIC_API_KEY=old\n', 'utf-8');

    await envSetOne('WOLF_ANTHROPIC_API_KEY', 'new', rcFile);

    const content = await fs.readFile(rcFile, 'utf-8');
    expect(content).toContain('export WOLF_ANTHROPIC_API_KEY=new');
    expect(content).not.toContain('=old');
    // Ensure the key appears exactly once after the update.
    const occurrences = (content.match(/WOLF_ANTHROPIC_API_KEY/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  // Typo guard: an unknown WOLF_* name must not silently land in the RC file
  // and must surface as a non-zero exit code.
  it('rejects unknown keys with exitCode 1 and does not touch the rc file', async () => {
    await envSetOne('WOLF_BOGUS_KEY', 'whatever', rcFile);

    expect(process.exitCode).toBe(1);
    // The rc file must not have been created or written.
    await expect(fs.stat(rcFile)).rejects.toThrow();
    // The error must name the offending key so the user can spot the typo.
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('WOLF_BOGUS_KEY'));
  });

  // Empty (whitespace-only) values should fail loudly rather than write an
  // empty export, which would silently overwrite a previously-set value.
  it('rejects whitespace-only values with exitCode 1', async () => {
    await envSetOne('WOLF_ANTHROPIC_API_KEY', '   ', rcFile);

    expect(process.exitCode).toBe(1);
    await expect(fs.stat(rcFile)).rejects.toThrow();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('must not be empty'));
  });
});
