import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  EnvApplicationService,
  EnvKeyStatus,
  EnvCleanupTarget,
  EnvSetOneResult,
  EnvKeyInfo,
} from '../envApplicationService.js';

const WOLF_KEYS = [
  'WOLF_ANTHROPIC_API_KEY',
  'WOLF_APIFY_API_TOKEN',
  'WOLF_GMAIL_CLIENT_ID',
  'WOLF_GMAIL_CLIENT_SECRET',
] as const;

const KEY_INFO: Record<(typeof WOLF_KEYS)[number], EnvKeyInfo> = {
  WOLF_ANTHROPIC_API_KEY: {
    prompt:  'Anthropic API Key',
    purpose: 'Powers all AI features: job scoring, resume tailoring, email drafting. Required.',
    howTo:   'console.anthropic.com → Sign up → API Keys → Create key',
  },
  WOLF_APIFY_API_TOKEN: {
    prompt:  'Apify API Token',
    purpose: 'Used by job provider integrations that access external services.',
    howTo:   'apify.com → Sign up → Settings → Integrations → API token (free tier available)',
  },
  WOLF_GMAIL_CLIENT_ID: {
    prompt:  'Gmail Client ID',
    purpose: 'Sends cold outreach emails via your Gmail account.',
    howTo:   'console.cloud.google.com → New project → APIs & Services → Credentials → OAuth 2.0 Client ID',
  },
  WOLF_GMAIL_CLIENT_SECRET: {
    prompt:  'Gmail Client Secret',
    purpose: 'Pair with Client ID for Gmail OAuth authentication.',
    howTo:   'Same OAuth 2.0 credential as above',
  },
};

const RC_FILES = [
  path.join(os.homedir(), '.zshrc'),
  path.join(os.homedir(), '.zprofile'),
  path.join(os.homedir(), '.bash_profile'),
  path.join(os.homedir(), '.bashrc'),
  path.join(os.homedir(), '.profile'),
];

const WOLF_EXPORT_LINE_RE = /^export\s+WOLF_/;

/**
 * Shell-rc-backed `EnvApplicationService`. Holds the canonical `WOLF_*` key
 * list and the rc file mutation primitives. Stateless apart from the const
 * key registry; safe to instantiate as a module singleton.
 */
export class EnvApplicationServiceImpl implements EnvApplicationService {
  readonly keys = WOLF_KEYS;
  readonly keyInfo = KEY_INFO;

  /** @inheritdoc */
  list(): EnvKeyStatus[] {
    return WOLF_KEYS.map((key) => ({ key, value: process.env[key] ?? null }));
  }

  /** @inheritdoc */
  detectRcFile(): string {
    const shell = process.env.SHELL ?? '';
    if (shell.includes('bash')) {
      return process.platform === 'darwin'
        ? path.join(os.homedir(), '.bash_profile')
        : path.join(os.homedir(), '.bashrc');
    }
    return path.join(os.homedir(), '.zshrc');
  }

  /** @inheritdoc */
  async writeBlock(rcFile: string, entries: { key: string; value: string }[]): Promise<void> {
    let content = '';
    try {
      content = await fs.readFile(rcFile, 'utf-8');
    } catch { /* file doesn't exist yet, will create */ }

    let updated = content;
    const toAppend: { key: string; value: string }[] = [];

    for (const { key, value } of entries) {
      const regex = new RegExp(`^export\\s+${key}=.*$`, 'm');
      if (regex.test(updated)) {
        updated = updated.replace(regex, `export ${key}=${value}`);
      } else {
        toAppend.push({ key, value });
      }
    }

    if (toAppend.length > 0) {
      const block = [
        '',
        '# wolf API keys',
        ...toAppend.map(({ key, value }) => `export ${key}=${value}`),
        '',
      ].join('\n');
      updated = updated.trimEnd() + '\n' + block;
    }

    await fs.writeFile(rcFile, updated, 'utf-8');
  }

  /** @inheritdoc */
  async setOne(key: string, value: string, rcFile?: string): Promise<EnvSetOneResult> {
    if (!(WOLF_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `unknown key "${key}". Valid: ${WOLF_KEYS.join(', ')}` };
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return { ok: false, error: `value for ${key} must not be empty` };
    }
    const target = rcFile ?? this.detectRcFile();
    await this.writeBlock(target, [{ key, value: trimmed }]);
    return { ok: true, target };
  }

  /** @inheritdoc */
  async findExports(): Promise<EnvCleanupTarget[]> {
    const matches: EnvCleanupTarget[] = [];
    for (const rc of RC_FILES) {
      let content: string;
      try {
        content = await fs.readFile(rc, 'utf-8');
      } catch {
        continue;
      }
      const wolfLines = content.split('\n').filter((l) => WOLF_EXPORT_LINE_RE.test(l.trim()));
      if (wolfLines.length > 0) {
        matches.push({ file: rc, lines: wolfLines });
      }
    }
    return matches;
  }

  /** @inheritdoc */
  async removeExports(files: string[]): Promise<void> {
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const cleaned = content
        .split('\n')
        .filter((l) => !WOLF_EXPORT_LINE_RE.test(l.trim()))
        .join('\n');
      await fs.writeFile(file, cleaned, 'utf-8');
    }
  }
}
