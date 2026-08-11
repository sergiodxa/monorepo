/**
 * The host convenience over `runTests`: load a `spec/` directory from disk, give
 * every test a fresh temp-directory workspace, and register the built-in
 * capabilities. This is what the CLI runs, and the answers it supplies — a
 * filesystem to read the suite from, a filesystem to run tests in, and all eight
 * built-ins — are exactly the ones a runtime without a process cannot give. An
 * embedder there calls `runTests` with its own answers instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { isFailure } from "@pkg/result";

import type { BuiltinNamespace } from "./builtins";
import type { SuiteResult } from "./diagnostics";
import type { SpecError } from "./errors";
import type { Grants } from "./permissions";
import type { Plugin } from "./plugin";

import { createBuiltinPlugins } from "./builtins";
import { loadSuite } from "./loader";
import { runTests } from "./run";
import { createWorkspace } from "./workspace";

/** What a `spec run` needs: the suite directory and the caller's grants. */
export interface RunOptions {
	/** Directory scanned recursively for `.spec` files. */
	root: string;
	/** The caller's permission grants, parsed from `--allow-*` flags. */
	grants: Grants;
	/** Extra plugins beyond the built-ins this run registers. */
	plugins?: Plugin[];
	/**
	 * Which built-in namespaces to register; omit for all of them, which is the
	 * CLI's behavior. Narrowing this is not a permission decision — a namespace
	 * left out does not exist, so a spec naming it fails to resolve instead of
	 * being told which flag would allow it (see `createBuiltinPlugins`).
	 */
	builtins?: readonly BuiltinNamespace[];
	/**
	 * How many tests may execute at once. `1` (the default) runs the suite
	 * strictly sequentially in source order; see `RunTestsOptions.concurrency`.
	 */
	concurrency?: number;
}

/**
 * Load and execute a suite from disk. Load failures (unreadable directory, parse
 * errors, duplicate definitions) fail the whole run before any test starts;
 * test failures do not — they are outcomes inside the returned result.
 *
 * @param options - Suite directory, grants, and optional plugin and concurrency choices.
 * @returns Per-test outcomes, or the error that prevented the run entirely.
 */
export async function runSuite(options: RunOptions): Promise<Result<SuiteResult, SpecError>> {
	let loaded = await loadSuite(options.root);
	if (isFailure(loaded)) return loaded;

	return runTests({
		suite: loaded.data,
		plugins: [...createBuiltinPlugins(options.builtins), ...(options.plugins ?? [])],
		grants: options.grants,
		createWorkspace,
		concurrency: options.concurrency,
	});
}
