import type { AddOptions, AddResult } from '../utils/types/index.js';

export interface AddApplicationService {
  // Stores a structured job (extracted by an AI caller) and returns its jobId.
  // Reuses an existing company row by name; otherwise creates one.
  add(options: AddOptions): Promise<AddResult>;
}
