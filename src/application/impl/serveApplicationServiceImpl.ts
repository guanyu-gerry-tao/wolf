import type { ServeApplicationService, ServeOptions } from '../serveApplicationService.js';
import type { BackgroundAiBatchWorker } from '../backgroundAiBatchWorker.js';
import type { HttpServer } from '../../transport/http/httpServer.js';

const BACKGROUND_WORKER_TICK_MS = 30_000;

export class ServeApplicationServiceImpl implements ServeApplicationService {
  constructor(
    private readonly httpServer: HttpServer,
    private readonly backgroundAiBatchWorker?: BackgroundAiBatchWorker,
  ) {}

  async run(options: ServeOptions): Promise<void> {
    await this.httpServer.start(options.port);
    process.stdout.write(`wolf serve listening on http://127.0.0.1:${options.port}\n`);
    process.stdout.write(formatCompanionSetupBanner(options.port));
    if (options.browser !== false) {
      process.stdout.write('Wolf Browser launch is not implemented yet.\n');
    }

    if (options.stopAfterStart) return;

    const workerTimer = this.startBackgroundWorker();

    await new Promise<void>((resolve, reject) => {
      const shutdown = async () => {
        process.off('SIGINT', shutdown);
        process.off('SIGTERM', shutdown);
        if (workerTimer) clearInterval(workerTimer);
        try {
          await this.httpServer.stop();
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });
  }

  private startBackgroundWorker(): ReturnType<typeof setInterval> | null {
    if (!this.backgroundAiBatchWorker) return null;

    const tick = () => {
      this.backgroundAiBatchWorker!.tick().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`wolf serve background worker failed: ${message}\n`);
      });
    };
    tick();
    return setInterval(tick, BACKGROUND_WORKER_TICK_MS);
  }
}

function formatCompanionSetupBanner(port: number): string {
  const bar = paint('='.repeat(64), 'cyan');
  const readMe = paint('USER PLEASE READ', 'green');
  const title = paint('WOLF COMPANION SETUP', 'bold');
  const portValue = paint(String(port), 'green');

  return [
    '',
    bar,
    `  ${readMe}`,
    `  ${title}`,
    '',
    '  Copy this port into the wolf companion browser extension:',
    `    Port:  ${portValue}`,
    '',
    '  Keep this terminal open while using the extension.',
    '  Stop:  Press Ctrl-C in this terminal.',
    bar,
    '',
  ].join('\n');
}

function paint(text: string, color: 'bold' | 'blue' | 'cyan' | 'green'): string {
  if (!process.stdout.isTTY || process.env.NO_COLOR) return text;
  const codes = {
    bold: ['\u001b[1m', '\u001b[22m'],
    blue: ['\u001b[34m', '\u001b[39m'],
    cyan: ['\u001b[36m', '\u001b[39m'],
    green: ['\u001b[32m', '\u001b[39m'],
  } satisfies Record<typeof color, [string, string]>;
  const [open, close] = codes[color];
  return `${open}${text}${close}`;
}
