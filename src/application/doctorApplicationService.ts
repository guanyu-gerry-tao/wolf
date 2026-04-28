/**
 * Per-file readiness check for one of the three profile markdown files.
 * Empty `missing` array means the file is "ready" by the relevant criterion;
 * non-empty means the user has work to do before tailor / fill / reach will
 * run cleanly.
 */
export interface FileCheck {
  file: string;
  ready: boolean;
  missing: string[];
  hint: string;
}

/**
 * Aggregate result of `wolf doctor`: one `FileCheck` per profile file plus a
 * roll-up `ready` flag (true iff every file passes its criterion).
 */
export interface DoctorReport {
  profileName: string;
  checks: FileCheck[];
  ready: boolean;
}

/**
 * Use case for `wolf doctor` — proactively reports which profile files still
 * need user input before tailor (and downstream fill / reach when they ship)
 * will run. Pure assessment: never modifies any file.
 *
 * Mirrors `assertReadyForTailor`'s checks so doctor output and tailor's
 * runtime errors stay in sync.
 */
export interface DoctorApplicationService {
  /**
   * Reads the default profile and returns the readiness report.
   * Strips `> [!IMPORTANT]` / `> [!TIP]` callout blocks before measuring
   * field content — an unfilled template body is correctly reported empty.
   */
  run(): Promise<DoctorReport>;
}
