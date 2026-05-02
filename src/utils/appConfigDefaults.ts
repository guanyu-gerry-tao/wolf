import type { AppConfig } from './types/index.js';

export const DEFAULT_SONNET_MODEL = 'anthropic/claude-sonnet-4-6';
export const DEFAULT_HAIKU_MODEL = 'anthropic/claude-haiku-4-5-20251001';

export type WorkspaceConfigFields = Pick<AppConfig,
  'default' | 'hunt' | 'tailor' | 'score' | 'reach' | 'fill'
>;

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfigFields = {
  default: 'default',
  hunt: { minScore: 0.5, maxResults: 50 },
  tailor: { model: DEFAULT_SONNET_MODEL, defaultCoverLetterTone: 'professional' },
  score: { model: DEFAULT_SONNET_MODEL },
  reach: { model: DEFAULT_SONNET_MODEL, defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
  fill: { model: DEFAULT_HAIKU_MODEL },
};

export const DEFAULT_COMPANION_CONFIG: AppConfig['companion'] = {
  servePort: 47823,
  maxStagehandSessions: 3,
  browserMode: 'wolf_persistent_profile',
};
