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

import type { Result } from "@sdxc/result";
import type { Seed } from "@sdxc/sample";

import { isFailure } from "@sdxc/result";

import type { BuiltinNamespace } from "./builtins.js";
import type { SuiteResult } from "./diagnostics.js";
import type { SpecError } from "./errors.js";
import type { Grants } from "./permissions.js";
import type { Plugin } from "./plugin.js";

import { createBuiltinPlugins } from "./builtins.js";
import { loadSuite } from "./loader.js";
import { runTests } from "./run.js";
import { createWorkspace } from "./workspace.js";

/** What a `spec run` needs: the suite directory and the caller's grants. */
export interface RunOptions {
	/** Directory scanned recursively for `.spec` files. */
	root: string;
	/** The caller's permission grants, parsed from `--allow-*` flags. */
	grants: Grants;
	/** Extra plugins beyond the built-ins this run registers. */
	plugins?: Plugin[];
	/**
	 * Which built-in namespaces to register; omit for all of them, as the CLI
	 * does. Excluding a namespace here makes it unresolvable, so a spec
	 * naming it fails as an unknown name (see `createBuiltinPlugins`).
	 */
	builtins?: readonly BuiltinNamespace[];
	/**
	 * How many tests may execute at once. `1` (the default) runs the suite
	 * strictly sequentially in source order; see `RunTestsOptions.concurrency`.
	 */
	concurrency?: number;
	/**
	 * The run's seed, which every test's generated data descends from; omit for
	 * the fixed default that makes two runs produce identical data.
	 */
	seed?: Seed;
}

/**
 * Load and execute a suite from disk. Load failures (unreadable directory,
 * parse errors, duplicate definitions) fail the whole run before any test
 * starts, while test failures surface as outcomes inside the returned result.
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
		seed: options.seed,
		root: options.root,
	});
}
