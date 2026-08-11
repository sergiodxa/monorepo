/**
 * Executing an already-loaded suite: give every test a fresh workspace, run it,
 * and collect structured results in source order. Everything the run depends on
 * arrives as an argument — the suite, the plugin set, the grants, the workspace
 * factory — so nothing here reaches for a filesystem, a process, or a specific
 * runtime. `runner.ts` is the host convenience that supplies the usual answers;
 * an embedder on a runtime without those answers calls this directly.
 *
 * Language semantics live in the executor and rendering lives in the reporter;
 * this module owns only the lifecycle glue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { isFailure, success } from "@pkg/result";

import type { DefinitionNode, TestNode } from "./ast";
import type { SuiteResult, TestResult } from "./diagnostics";
import type { SpecError } from "./errors";
import type { Grants, PermissionSet } from "./permissions";
import type { Plugin } from "./plugin";
import type { LoadedSuite } from "./sources";
import type { Workspace } from "./workspace";

import { executeTest } from "./executor";
import { createPermissionSet } from "./permissions";
import { createRegistry } from "./registry";

/** Creates the isolated workspace one test runs in. */
export type WorkspaceFactory = (
	permissions: PermissionSet,
) => Promise<Result<Workspace, SpecError>>;

/** Everything executing a loaded suite depends on, all of it injected. */
export interface RunTestsOptions {
	/** The parsed suite, from `loadSuite` (a directory) or `loadSources` (strings). */
	suite: LoadedSuite;
	/**
	 * Every plugin whose namespace this run understands — the complete set, not
	 * additions to a default one. A namespace left out is not denied, it does not
	 * exist: a spec naming it fails to resolve, which is the difference between
	 * "you may not" and "there is no such thing". Build the built-in ones with
	 * `createBuiltinPlugins`, or hand-pick factories on a runtime where some of
	 * them cannot be imported at all.
	 */
	plugins: Plugin[];
	/** The caller's permission grants, scoping what the registered plugins may reach. */
	grants: Grants;
	/** How each test's workspace is created; called once per test. */
	createWorkspace: WorkspaceFactory;
	/**
	 * How many tests may execute at once. `1` (the default) runs the suite
	 * strictly sequentially in source order. A value `N > 1` lets up to N
	 * independent tests overlap; because each test already gets its own isolated
	 * workspace they do not interfere at this level. Results are always collected
	 * in SOURCE order regardless of completion order, so the report and exit code
	 * stay byte-for-byte deterministic. A shared, mutable app under test (the same
	 * database rows, one stateful server) is not isolated by the workspace and may
	 * still require `concurrency: 1`. Values below 1 are clamped to 1.
	 */
	concurrency?: number;
}

/**
 * Execute every test in a loaded suite.
 *
 * Test failures are outcomes inside the returned result, not errors; only a
 * failure to create a workspace aborts the run, since a test cannot be said to
 * have passed or failed if it never got a place to run.
 *
 * @param options - The suite, its plugin set, the grants, and the workspace factory.
 * @returns Per-test outcomes in source order, or the error that aborted the run.
 */
export async function runTests(options: RunTestsOptions): Promise<Result<SuiteResult, SpecError>> {
	let suite = options.suite;
	let plugins = options.plugins;
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
	// the shared registry and permissions to run it. This order — files in the
	// order the suite was loaded, tests in file order — is the order results are
	// reported and the exit code is computed in, independent of the order workers
	// finish below.
	let pending: { test: TestNode; filePath: string; imported: readonly string[] }[] = [];
	for (let file of suite.files) {
		let imported = file.uses.map((use) => use.namespace);
		for (let test of file.tests) pending.push({ test, filePath: file.path, imported });
	}

	// Bounded concurrency: up to `concurrency` workers pull from the shared work
	// list and write each outcome back into its SOURCE slot, so `results` is
	// source-ordered no matter which worker finishes first. `1` (the default)
	// means a single worker, i.e. strictly sequential.
	let concurrency = Math.max(1, Math.trunc(options.concurrency ?? 1));
	let results: (TestResult | undefined)[] = Array.from({ length: pending.length });
	let nextIndex = 0;
	// The first fatal workspace-creation failure, if any: it aborts the whole run.
	// In-flight tests finish; no new work is pulled once it is set; the run then
	// returns this failure.
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
			let workspace = await options.createWorkspace(permissions);
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

	// Wall-clock spans the whole test-execution phase: captured immediately
	// before the workers start and immediately after the last one finishes, so it
	// measures real elapsed time whether the run was sequential or concurrent.
	// This is what the summary reports — never the sum of per-test durations,
	// which overcounts because concurrent tests overlap. Teardown below is
	// excluded; it is cleanup, not test execution.
	let wallStart = performance.now();
	let wallMs = 0;
	try {
		let workerCount = Math.min(concurrency, pending.length);
		let workers: Promise<void>[] = [];
		for (let slot = 0; slot < workerCount; slot += 1) workers.push(runWorker());
		await Promise.all(workers);
		wallMs = performance.now() - wallStart;
		if (fatal !== undefined) return fatal;
	} finally {
		// Plugins with external state (a browser session, a connection) release it
		// once here, after every test. Teardown is best-effort: a throwing dispose
		// must never turn a completed run into a thrown error.
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
	return success({ results: ordered, passed, failed: ordered.length - passed, wallMs });
}
