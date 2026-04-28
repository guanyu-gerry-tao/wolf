import { createAppContext, type AppContext } from '../../runtime/appContext.js';

/**
 * Lists every profile directory under profiles/, marking the default with `*`.
 */
export async function profileList(ctx: AppContext = createAppContext()): Promise<void> {
  const result = await ctx.profileApp.list();
  if (result.kind === 'no-profiles-dir') {
    console.log('No profiles directory. Run `wolf init` first.');
    return;
  }
  if (result.kind === 'empty') {
    console.log('No profiles. Run `wolf init` or `wolf profile create <name>`.');
    return;
  }
  for (const { name, isDefault } of result.profiles) {
    const marker = isDefault ? '*' : ' ';
    console.log(`${marker} ${name}`);
  }
}

/**
 * Creates a new profile under profiles/<name>/, cloning from the source profile.
 */
export async function profileCreate(
  name: string,
  opts: { from?: string } = {},
  ctx: AppContext = createAppContext(),
): Promise<void> {
  const r = await ctx.profileApp.create(name, opts);
  console.log(`Created profile: ${r.name} (cloned from "${r.from}")`);
}

/**
 * Switches the default profile by updating `wolf.toml.default`.
 */
export async function profileUse(name: string, ctx: AppContext = createAppContext()): Promise<void> {
  await ctx.profileApp.use(name);
  console.log(`Default profile set to: ${name}`);
}

/**
 * Deletes a profile directory. Refuses to delete the current default.
 */
export async function profileDelete(
  name: string,
  opts: { yes?: boolean } = {},
  ctx: AppContext = createAppContext(),
): Promise<void> {
  await ctx.profileApp.delete(name, opts);
  console.log(`Deleted profile: ${name}`);
}
