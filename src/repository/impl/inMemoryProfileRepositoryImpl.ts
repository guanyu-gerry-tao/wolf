import type { ProfileRepository } from '../profileRepository.js';
import type { UserProfile } from '../../types/index.js';

const MOCK_PROFILE: UserProfile = {
  id: 'default',
  label: 'Test Profile',
  name: 'Test User',
  email: 'test@example.com',
  phone: '+1 555 000 0000',
  firstUrl: null,
  secondUrl: null,
  thirdUrl: null,
  immigrationStatus: 'no limit',
  willingToRelocate: false,
  targetRoles: ['Software Engineer'],
  targetLocations: ['Remote'],
  scoringNotes: null,
};

export class InMemoryProfileRepositoryImpl implements ProfileRepository {
  async get(id: string): Promise<UserProfile | null> {
    return id === MOCK_PROFILE.id ? MOCK_PROFILE : null;
  }
  async getDefault(): Promise<UserProfile> { return MOCK_PROFILE; }
  async list(): Promise<UserProfile[]> { return [MOCK_PROFILE]; }
  async getResumePool(_profileId: string): Promise<string> {
    return '[mock resume pool]';
  }
}
