import type { AppContext } from '../../runtime/appContext.js';
import { createAppContext } from '../../runtime/appContext.js';
import { currentBinaryName } from '../../utils/instance.js';
import type { DoctorReport } from '../../application/doctorApplicationService.js';

export type { DoctorReport, FileCheck } from '../../application/doctorApplicationService.js';

/**
 * Reads the default profile and reports which files still need user input
 * before tailor (and downstream fill / reach when they ship) will run.
 */
export async function doctor(
  _options: Record<string, never> = {},
  ctx: AppContext = createAppContext(),
): Promise<DoctorReport> {
  return ctx.doctorApp.run();
}

/** Render a DoctorReport as user-facing text. Pure formatter. */
export function formatDoctor(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(`wolf doctor — profile readiness check`);
  lines.push(``);
  lines.push(`Profile: ${report.profileName}`);
  lines.push(``);
  for (const c of report.checks) {
    const mark = c.ready ? '✓' : '✗';
    lines.push(`${mark} ${c.file}`);
    if (c.missing.length > 0) {
      for (const m of c.missing) lines.push(`    - ${m}`);
    }
    lines.push(`    ${c.hint}`);
    lines.push(``);
  }
  lines.push(`Status: ${report.ready ? 'READY' : 'NOT READY'}`);
  if (!report.ready) {
    lines.push(``);
    lines.push(`Open profiles/${report.profileName}/profile.md and fill the > [!IMPORTANT]`);
    lines.push(`sections, then re-run \`${currentBinaryName()} doctor\`.`);
  }
  return lines.join('\n');
}
