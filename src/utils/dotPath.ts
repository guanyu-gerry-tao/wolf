/**
 * Shared helpers for CLI dot-path access into wolf.toml and profile.toml.
 * `wolf config get tailor.model` and `wolf profile set name "Jane"` both
 * route through these primitives.
 */

/**
 * Reads a value from a nested object via dot-path (e.g. "tailor.model").
 * Returns undefined if any segment is missing or a non-object is encountered mid-path.
 */
export function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Returns a deep clone of `obj` with `value` written at `path`. Intermediate
 * objects are created if absent. The input is not mutated.
 */
export function setByPath<T extends object>(obj: T, path: string, value: unknown): T {
  const parts = path.split('.');
  const result = structuredClone(obj);
  let cur: Record<string, unknown> = result as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = cur[part];
    if (next === null || typeof next !== 'object') {
      cur[part] = {};
    }
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return result;
}

/**
 * Coerces a CLI-typed string into the runtime shape expected at a target path.
 * Uses the *current* value's type as the guide so Zod's downstream validation
 * gets the right kind of value (avoids JSON.parse ambiguity for things like
 * phone numbers). Arrays accept comma-separated. Booleans accept "true"/"false".
 * Falls back to plain string if no current value exists.
 */
export function coerceToShape(valueStr: string, currentValue: unknown): unknown {
  if (typeof currentValue === 'number') {
    const n = Number(valueStr);
    if (Number.isNaN(n)) throw new Error(`Expected number, got "${valueStr}"`);
    return n;
  }
  if (typeof currentValue === 'boolean') {
    if (valueStr === 'true') return true;
    if (valueStr === 'false') return false;
    throw new Error(`Expected boolean ("true" or "false"), got "${valueStr}"`);
  }
  if (Array.isArray(currentValue)) {
    return valueStr.split(',').map(s => s.trim()).filter(Boolean);
  }
  return valueStr;
}
