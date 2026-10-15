/**
 * The hosting process's environment and working directory, the fallback a public entry point
 * uses when its caller names neither. Every read is guarded, so a runtime without a `process`
 * global (a Worker) gets an empty environment and the root directory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The variables a run reads when its caller supplied none: the host process's own, read live so
 * a change to `process.env` before the run is visible to it.
 */
export function hostEnv(): Readonly<Record<string, string | undefined>> {
	return typeof process === "undefined" ? {} : process.env;
}

/** The directory relative paths resolve against when a caller supplied none. */
export function hostCwd(): string {
	return typeof process === "undefined" ? "/" : process.cwd();
}
