import os from 'node:os';
import path from 'node:path';

declare const __WOLF_BUILD_MODE__: string | undefined;

export type WolfMode = 'stable' | 'dev';

export const DEV_WARNING = 'DEVELOPING VERSION - not for production';

function bakedBuildMode(): string | undefined {
  if (typeof __WOLF_BUILD_MODE__ !== 'undefined') return __WOLF_BUILD_MODE__;
  return undefined;
}

export function getBuildMode(): WolfMode {
  const mode = bakedBuildMode() ?? process.env.WOLF_BUILD_MODE;
  return mode === 'dev' ? 'dev' : 'stable';
}

export function isDevBuild(): boolean {
  return getBuildMode() === 'dev';
}

export function resolveWorkspaceDir(options: { here?: boolean } = {}): string {
  if (options.here) return process.cwd();
  if (isDevBuild()) {
    return process.env.WOLF_DEV_HOME ?? path.join(os.homedir(), 'wolf-dev');
  }
  return process.env.WOLF_HOME ?? path.join(os.homedir(), 'wolf');
}

export function getEnvValue(name: string): string | undefined {
  if (isDevBuild()) {
    return process.env[`WOLF_DEV_${name}`] ?? process.env[`WOLF_${name}`];
  }
  return process.env[`WOLF_${name}`];
}

export function assertDevBuildForDevFlag(): void {
  if (!isDevBuild()) {
    throw new Error('--dev requires a dev build; run `npm run build:dev` then retry from the clone.');
  }
}

/**
 * Bin name the user just typed — `wolf` for stable, `wolf-dev` for dev.
 * Used in user-facing error messages so the suggested fix command matches
 * whichever binary they're actually running.
 */
export function currentBinaryName(): string {
  return isDevBuild() ? 'wolf-dev' : 'wolf';
}

/**
 * Env var that overrides the workspace directory for the current build.
 * `WOLF_DEV_HOME` for dev builds, `WOLF_HOME` for stable.
 */
export function workspaceEnvVarName(): string {
  return isDevBuild() ? 'WOLF_DEV_HOME' : 'WOLF_HOME';
}
