/**
 * Per-file readiness report. Empty `missing` array means the file is
 * "ready" by the relevant criterion.
 */
export interface FileCheck {
  file: string;
  ready: boolean;
  missing: string[];
  hint: string;
}

export interface DoctorReport {
  profileName: string;
  checks: FileCheck[];
  ready: boolean;
}

export interface DoctorApplicationService {
  // Reads the default profile and reports which files still need user input
  // before tailor (and downstream fill / reach when they ship) will run.
  run(): Promise<DoctorReport>;
}
