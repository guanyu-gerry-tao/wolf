import type { ProfileRepository } from '../profileRepository.js';
import type { Profile } from '../../utils/types/index.js';
import { parseProfileToml, type ProfileToml } from '../../utils/profileToml.js';
import {
  renderProfileMarkdown,
  renderResumePoolMarkdown,
  renderStandardQuestionsMarkdown,
} from '../../utils/profileTomlRender.js';
import { profileTomlTemplate } from '../../utils/profileTomlGenerate.js';

// Minimal stub TOML that satisfies the v2 schema. Tests that need richer
// profile content should instantiate their own repo subclass or build a
// ProfileToml directly rather than relying on this default.
//
// We start from the bundled template (so every field is present and zod
// defaults are applied uniformly), then override identity.legal_first_name
// and legal_last_name so the mock profile has a non-empty resume header
// for tests that gate on `assertReadyForTailor` style checks.
const MOCK_NAME = 'default';

const MOCK_PROFILE_TOML: ProfileToml = (() => {
  const parsed = parseProfileToml(profileTomlTemplate);
  return {
    ...parsed,
    identity: {
      ...parsed.identity,
      legal_first_name: 'Test',
      legal_last_name: 'User',
    },
    contact: {
      ...parsed.contact,
      email: 'test@example.com',
      phone: '+1 555 010 0100',
    },
    address: {
      ...parsed.address,
      full: '123 Test St, Test City, TS 00000',
    },
    links: {
      ...parsed.links,
      first: 'https://linkedin.com/in/test-user',
    },
  };
})();

const MOCK_PROFILE: Profile = {
  name: MOCK_NAME,
  md: renderProfileMarkdown(MOCK_PROFILE_TOML),
};

/**
 * Test-only `ProfileRepository`. Returns a single mock profile named
 * `default` with just enough content to pass the "non-empty profile" contract.
 * Tests that need richer fixtures should construct their own repo or
 * `Profile` rather than extending this.
 */
export class InMemoryProfileRepositoryImpl implements ProfileRepository {
  async get(name: string): Promise<Profile | null> {
    return name === MOCK_NAME ? MOCK_PROFILE : null;
  }
  async getDefault(): Promise<Profile> { return MOCK_PROFILE; }
  async list(): Promise<string[]> { return [MOCK_NAME]; }
  async getProfileToml(name: string): Promise<ProfileToml> {
    if (name !== MOCK_NAME) throw new Error(`profile not found: ${name}`);
    return MOCK_PROFILE_TOML;
  }
  async getProfileMd(name: string): Promise<string> {
    if (name !== MOCK_NAME) throw new Error(`profile not found: ${name}`);
    return renderProfileMarkdown(MOCK_PROFILE_TOML);
  }
  async getResumePool(name: string): Promise<string> {
    if (name !== MOCK_NAME) throw new Error(`profile not found: ${name}`);
    return renderResumePoolMarkdown(MOCK_PROFILE_TOML);
  }
  async getStandardQuestions(name: string): Promise<string> {
    if (name !== MOCK_NAME) throw new Error(`profile not found: ${name}`);
    return renderStandardQuestionsMarkdown(MOCK_PROFILE_TOML);
  }
  async getAttachmentsList(_name: string): Promise<string[]> {
    return [];
  }
}
