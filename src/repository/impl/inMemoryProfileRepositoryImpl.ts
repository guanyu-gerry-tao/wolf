import type { ProfileRepository } from '../profileRepository.js';
import type { Profile } from '../../utils/types/index.js';

// Minimal stub MD that satisfies the "non-empty profile.md" contract. Tests
// that need richer profile content should instantiate their own repo subclass
// or build a Profile directly rather than relying on this default.
const MOCK_NAME = 'default';
const MOCK_PROFILE_MD = '# default\n\n## Identity\n\n### Legal first name\nTest\n\n### Legal last name\nUser\n';
const MOCK_RESUME_POOL = '[mock resume pool]';
const MOCK_STANDARD_QUESTIONS = '[mock standard questions]';

const MOCK_PROFILE: Profile = {
  name: MOCK_NAME,
  md: MOCK_PROFILE_MD,
};

export class InMemoryProfileRepositoryImpl implements ProfileRepository {
  async get(name: string): Promise<Profile | null> {
    return name === MOCK_NAME ? MOCK_PROFILE : null;
  }
  async getDefault(): Promise<Profile> { return MOCK_PROFILE; }
  async list(): Promise<string[]> { return [MOCK_NAME]; }
  async getProfileMd(name: string): Promise<string> {
    if (name !== MOCK_NAME) throw new Error(`profile not found: ${name}`);
    return MOCK_PROFILE_MD;
  }
  async getResumePool(name: string): Promise<string> {
    if (name !== MOCK_NAME) throw new Error(`profile not found: ${name}`);
    return MOCK_RESUME_POOL;
  }
  async getStandardQuestions(name: string): Promise<string> {
    if (name !== MOCK_NAME) throw new Error(`profile not found: ${name}`);
    return MOCK_STANDARD_QUESTIONS;
  }
  async getAttachmentsList(_name: string): Promise<string[]> {
    return [];
  }
}
