import { createAppContext, type AppContext } from '../../runtime/appContext.js';

export const DEFAULT_SERVE_PORT = 47823;

export interface ServeCommandOptions {
  port?: number;
  browser?: boolean;
  stopAfterStart?: boolean;
}

export async function serve(
  options: ServeCommandOptions = {},
  ctx: AppContext = createAppContext(),
): Promise<void> {
  await ctx.serveApp.run({
    port: options.port ?? DEFAULT_SERVE_PORT,
    browser: options.browser ?? true,
    stopAfterStart: options.stopAfterStart,
  });
}
