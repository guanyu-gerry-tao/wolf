export type CompanionArtifactKind = 'resume' | 'cover-letter';

export interface CompanionArtifactSlot {
  status: 'not_ready' | 'ready';
  url: string | null;
}

export interface CompanionArtifactReadiness {
  jobId: string;
  resume: CompanionArtifactSlot;
  coverLetter: CompanionArtifactSlot;
}

export interface CompanionArtifactFile {
  path: string;
  contentType: string;
}

export interface ArtifactApplicationService {
  getReadiness(jobId: string, baseUrl: string): Promise<CompanionArtifactReadiness>;
  getPreviewFile(jobId: string, kind: CompanionArtifactKind): Promise<CompanionArtifactFile>;
}
