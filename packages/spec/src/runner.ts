/**
 * Suite orchestration: load a `spec/` directory, then give every test a
 * fresh isolated workspace, execute it, and collect structured results. The
 * runner owns the lifecycle glue; language semantics live in the executor
 * and rendering lives in the reporter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { isFailure, success } from "@pkg/result";

import type { DefinitionNode, TestNode } from "./ast";
import type { SuiteResult, TestResult } from "./diagnostics";
import type { SpecError } from "./errors";
import type { Grants } from "./permissions";
import type { Plugin } from "./plugin";

import { executeTest } from "./executor";
import { loadSuite } from "./loader";
import { createPermissionSet } from "./permissions";
import { createBrowserPlugin } from "./plugins/browser";
import { createCliPlugin } from "./plugins/cli";
import { createDbPlugin } from "./plugins/db";
import { createFsPlugin } from "./plugins/fs";
import { createHttpPlugin } from "./plugins/http";
import { createRegistry } from "./registry";
import { createWorkspace } from "./workspace";

/** What a `spec run` needs: the suite directory and the caller's grants. */
export interface RunOptions {
	/** Directory scanned recursively for `.spec` files. */
	root: string;
	/** The caller's permission grants, parsed from `--allow-*` flags. */
	grants: Grants;
	/** Extra plugins beyond the built-in `fs`, `cli`, `http`, `browser`, and `db`. */
	plugins?: Plugin[];
	/**
	 * How many tests may execute at once. `1` (the default) runs the suite
	 * strictly sequentially in source order — today's behavior. A value `N > 1`
	 * lets up to N independent tests overlap; because each test already gets its
	 * own isolated workspace they do not interfere at the runner level. Results
	 * are always collected in SOURCE order regardless of completion order, so the
	 * report and exit code stay byte-for-byte deterministic. A shared, mutable app
	 * under test (the same database rows, one stateful server) is not isolated by
	 * the workspace and may still require `concurrency: 1`. Values below 1 are
	 * clamped to 1; the CLI rejects non-positive integers as a usage error.
	 */
	concurrency?: number;
}

/**
 * Load and execute a suite. Load failures (unreadable directory, parse
 * errors, duplicate definitions) fail the whole run before any test starts;
 * test failures do not — they are outcomes inside the returned result.
 *
 * @param options - Suite directory, grants, and optional extra plugins.
 * @returns Per-test outcomes, or the error that prevented the run entirely.
 */
export async function runSuite(options: RunOptions): Promise<Result<SuiteResult, SpecError>> {
	let loaded = await loadSuite(options.root);
	if (isFailure(loaded)) return loaded;
	let suite = loaded.data;

	let plugins = [
		createFsPlugin(),
		createCliPlugin(),
		createHttpPlugin(),
		createBrowserPlugin(),
		createDbPlugin(),
		...(options.plugins ?? []),
	];
	let registry = createRegistry(plugins, suite);
	let permissions = createPermissionSet(options.grants);

	// `use` is file-scoped: a definition's body resolves bare names against
	// the imports of the file that defined it, not the caller's file. The
	// defining file also anchors errors raised inside the body, so a failure
	// in a shared command reports its own file:line, not the calling test's.
	let usesByDefinition = new Map<DefinitionNode, readonly string[]>();
	let fileByDefinition = new Map<DefinitionNode, string>();
	for (let file of suite.files) {
		let imported = file.uses.map((use) => use.namespace);
		for (let definition of file.definitions) {
			usesByDefinition.set(definition, imported);
			fileByDefinition.set(definition, file.path);
		}
	}

	// Flatten every test into one source-ordered work list. Each unit carries
	// its file path and that file's `use` imports, so a worker needs nothing but
	// the shared registry and permissions to run it. This order — files sorted by
	// the loader, tests in file order — is the order results are reported and the
	// exit code is computed in, independent of the order workers finish below.
	let pending: { test: TestNode; filePath: string; imported: readonly string[] }[] = [];
	for (let file of suite.files) {
		let imported = file.uses.map((use) => use.namespace);
		for (let test of file.tests) pending.push({ test, filePath: file.path, imported });
	}

	// Bounded concurrency: up to `concurrency` workers pull from the shared work
	// list and write each outcome back into its SOURCE slot, so `results` is
	// source-ordered no matter which worker finishes first. `1` (the default)
	// means a single worker, i.e. strictly sequential — today's exact behavior.
	let concurrency = Math.max(1, Math.trunc(options.concurrency ?? 1));
	let results: (TestResult | undefined)[] = Array.from({ length: pending.length });
	let nextIndex = 0;
	// The first fatal workspace-creation failure, if any: it aborts the whole run
	// exactly as the sequential path's early `return` did. In-flight tests finish;
	// no new work is pulled once it is set; the run then returns this failure.
	let fatal: Result<SuiteResult, SpecError> | undefined;

	// One worker: claim the next source index, run that test in its own fresh
	// workspace, record the outcome, repeat until the list is drained or a fatal
	// failure is seen. Claiming `nextIndex` is race-free — there is no `await`
	// between reading and incrementing it, so no two workers claim the same slot.
	async function runWorker(): Promise<void> {
		while (fatal === undefined) {
			let index = nextIndex;
			nextIndex += 1;
			if (index >= pending.length) return;
			let unit = pending[index];
			if (unit === undefined) return;
			let workspace = await createWorkspace(permissions);
			if (isFailure(workspace)) {
				fatal ??= workspace;
				return;
			}
			let startedAt = performance.now();
			let outcome = await executeTest(unit.test, {
				registry,
				workspace: workspace.data,
				permissions,
				uses: unit.imported,
				usesFor: (definition) => usesByDefinition.get(definition) ?? unit.imported,
				fileFor: (definition) => fileByDefinition.get(definition),
				grants: options.grants,
			});
			let durationMs = performance.now() - startedAt;
			await workspace.data.cleanup();
			if (isFailure(outcome)) {
				let error = outcome.error;
				if (error.file === undefined) error.file = unit.filePath;
				results[index] = {
					title: unit.test.title,
					file: unit.filePath,
					status: "failed",
					error,
					durationMs,
				};
			} else {
				results[index] = {
					title: unit.test.title,
					file: unit.filePath,
					status: "passed",
					durationMs,
				};
			}
		}
	}

	try {
		let workerCount = Math.min(concurrency, pending.length);
		let workers: Promise<void>[] = [];
		for (let slot = 0; slot < workerCount; slot += 1) workers.push(runWorker());
		await Promise.all(workers);
		if (fatal !== undefined) return fatal;
	} finally {
		// Plugins with process-external state (a browser session, a connection)
		// release it once here, after every test. Teardown is best-effort: a
		// throwing dispose must never turn a completed run into a thrown error.
		for (let plugin of plugins) {
			if (plugin.dispose === undefined) continue;
			try {
				await plugin.dispose();
			} catch {
				// Ignored: cleanup failures are not run failures.
			}
		}
	}

	// Every slot is filled once the run completes without a fatal failure (each
	// claimed index writes exactly one result), so this both drops the sparse
	// `undefined` type and preserves source order.
	let ordered = results.filter((result): result is TestResult => result !== undefined);
	let passed = ordered.filter((result) => result.status === "passed").length;
	return success({ results: ordered, passed, failed: ordered.length - passed });
}
