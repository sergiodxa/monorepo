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
	 * additions to a default one. Leaving a namespace out makes it nonexistent
	 * to a spec, not merely forbidden, so referencing it fails to resolve.
	 *
	 * @see createBuiltinPlugins
	 */
	plugins: Plugin[];
	/** The caller's permission grants, scoping what the registered plugins may reach. */
	grants: Grants;
	/** How each test's workspace is created; called once per test. */
	createWorkspace: WorkspaceFactory;
	/**
	 * How many tests may execute at once, each in its own isolated workspace.
	 * Results stay source-ordered regardless of completion order, though a
	 * shared, mutable app under test may still require `concurrency: 1`.
	 *
	 * @default 1
	 */
	concurrency?: number;
}

/**
 * Execute every test in a loaded suite. Test failures land as outcomes in the
 * returned result, not thrown errors; only a workspace-creation failure aborts
 * the run, since a test that never got a place to run has no pass or fail.
 *
 * @param options - The suite, its plugin set, the grants, and the workspace factory.
 * @returns Per-test outcomes in source order, or the error that aborted the run.
 */
export async function runTests(options: RunTestsOptions): Promise<Result<SuiteResult, SpecError>> {
	let suite = options.suite;
	let plugins = options.plugins;
	let registry = createRegistry(plugins, suite);
	let permissions = createPermissionSet(options.grants);

	/**
	 * `use` is file-scoped: a definition's body resolves bare names against the
	 * imports of the file that defined it, so errors raised inside a shared
	 * command report that file's location, not the calling test's.
	 */
	let usesByDefinition = new Map<DefinitionNode, readonly string[]>();
	let fileByDefinition = new Map<DefinitionNode, string>();
	for (let file of suite.files) {
		let imported = file.uses.map((use) => use.namespace);
		for (let definition of file.definitions) {
			usesByDefinition.set(definition, imported);
			fileByDefinition.set(definition, file.path);
		}
	}

	/**
	 * Every test flattened into one source-ordered work list; each unit carries
	 * its own file path and `use` imports, so a worker needs nothing but the
	 * shared registry and permissions to run it.
	 */
	let pending: { test: TestNode; filePath: string; imported: readonly string[] }[] = [];
	for (let file of suite.files) {
		let imported = file.uses.map((use) => use.namespace);
		for (let test of file.tests) pending.push({ test, filePath: file.path, imported });
	}

	let concurrency = Math.max(1, Math.trunc(options.concurrency ?? 1));
	let results: (TestResult | undefined)[] = Array.from({ length: pending.length });
	let nextIndex = 0;
	/**
	 * The first fatal workspace-creation failure, if any. In-flight tests still
	 * finish and no new work is pulled once this is set; the run then returns
	 * this failure.
	 */
	let fatal: Result<SuiteResult, SpecError> | undefined;

	/**
	 * Claims the next source index and runs it in a fresh workspace, repeating
	 * until the list drains or a fatal failure appears. Claiming `nextIndex` is
	 * race-free: nothing awaits between reading and incrementing it.
	 */
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

	/**
	 * Wall-clock spans only the test-execution phase: captured immediately
	 * before workers start and immediately after the last one finishes, giving
	 * real elapsed time whether the run was sequential or concurrent.
	 */
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
		/**
		 * Plugins with external state (a browser session, a connection) release
		 * it here, once per test. A throwing dispose here still lets a completed
		 * run return its results.
		 */
		for (let plugin of plugins) {
			if (plugin.dispose === undefined) continue;
			try {
				await plugin.dispose();
			} catch {}
		}
	}

	/**
	 * Every slot is filled once the run completes without a fatal failure,
	 * since each claimed index writes exactly one result; filtering here only
	 * narrows the sparse `undefined` type while preserving source order.
	 */
	let ordered = results.filter((result): result is TestResult => result !== undefined);
	let passed = ordered.filter((result) => result.status === "passed").length;
	return success({ results: ordered, passed, failed: ordered.length - passed, wallMs });
}
