/**
 * Interactive setup wizard. Run once before using any other wolf command.
 *
 * Prompts the user for:
 * - Resume `.tex` path, target roles and locations, immigration status
 * - API keys (Anthropic, Apify, Gmail) — written to `.env`
 *
 * Creates `~/.wolf/config.json` with a default profile and provider config.
 */
export async function init(): Promise<void> {
  // TODO: interactive wizard using readline/inquirer
  // TODO: prompt for: resume path, target roles, target locations, immigration status
  // TODO: prompt for API keys (ANTHROPIC, APIFY, GMAIL) and write to .env
  // TODO: create default AppConfig and write to ~/.wolf/config.json
  // TODO: write ~/.wolf/README.txt explaining the directory and how to reset
  throw new Error('Not implemented');
}
