/**
 * Executing an already-loaded suite: run the suite's `setup`, give every test
 * attempt a fresh workspace, run it, and collect structured results in source
 * order. Everything the run depends on arrives as an argument — the suite, the
 * plugin set, the grants, the workspace factory — so nothing here reaches for a
 * filesystem, a process, or a specific runtime. `runner.ts` is the host
 * convenience that supplies the usual answers; an embedder on a runtime without
 * those answers calls this directly.
 *
 * Language semantics live in the executor and rendering lives in the reporter;
 * this module owns only the lifecycle glue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { relative, sep } from "node:path";

import type { Result } from "@sdxc/result";
import type { Random, Seed } from "@sdxc/sample";

import { failure, isFailure, success } from "@sdxc/result";
import { createRandom } from "@sdxc/sample";

import type { ArtifactStore } from "./artifacts.js";
import type { DefinitionNode, HookNode, SpecFileNode, TestNode } from "./ast.js";
import type { BaseSet, ConnectionSet } from "./bases.js";
import type { SuiteResult, TestResult } from "./diagnostics.js";
import type { SpecError } from "./errors.js";
import type { Grants, PermissionSet } from "./permissions.js";
import type { Plugin, RunIdentity } from "./plugin.js";
import type { LoadedSuite } from "./sources.js";
import type { Workspace } from "./workspace.js";

import { createBaseSet, createConnectionSet } from "./bases.js";
import { LoadError } from "./errors.js";
import { executeHook, executeTest } from "./executor.js";
import { createPermissionSet } from "./permissions.js";
import { createRegistry } from "./registry.js";

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
	/** How each test's workspace is created; called once per test attempt. */
	createWorkspace: WorkspaceFactory;
	/**
	 * How many tests may execute at once, each in its own isolated workspace.
	 * Results stay source-ordered regardless of completion order, though a
	 * shared, mutable app under test may still require `concurrency: 1`.
	 *
	 * @default 1
	 */
	concurrency?: number;
	/**
	 * The run's seed, which every test's generated data descends from. A fixed
	 * default makes two runs of a suite produce identical data; pass a drawn
	 * seed to shake a suite for hidden dependence on particular values.
	 *
	 * @default "spec"
	 */
	seed?: Seed;
	/**
	 * What this run is called, which a spec composes into the identities it
	 * generates. Omit to draw one, which is what makes those identities unique
	 * across runs; pass the id a previous run printed to replay it.
	 */
	runId?: string;
	/**
	 * How many further attempts a failing test gets. Every attempt draws the
	 * same data and gets a fresh workspace, and a test that passes on one of
	 * them is reported `flaky` rather than `passed`.
	 *
	 * @default 0
	 */
	retries?: number;
	/**
	 * The run's named bases, which every relative target resolves against.
	 * Omit for a run that configured none, where an unqualified target fails
	 * naming the configuration it would need.
	 */
	bases?: BaseSet;
	/** The run's named database connections, selected the same way bases are. */
	connections?: ConnectionSet;
	/** Where a failing test writes its diagnostics; omit to leave them text. */
	artifacts?: ArtifactStore;
	/**
	 * The suite directory, which a test's seed measures its file against so the
	 * data a suite generates does not follow the suite's absolute location on
	 * disk. Omit when the sources came from strings rather than a directory.
	 */
	root?: string;
}

/** The run seed used when a caller names none, so a bare run repeats exactly. */
export const DEFAULT_SEED = "spec";

/** How the reporter titles the teardown hook's failure among the results. */
const TEARDOWN_TITLE = "teardown";

/**
 * Draw a name for this run: short, lowercase, and safe in a URL, a file name
 * and a SQL literal alike, so a spec can compose it into generated identity
 * and a person can grep the rows it left behind.
 *
 * @returns A fresh run id, which no earlier run produced.
 */
export function createRunId(): string {
	let stamp = Date.now().toString(36);
	let noise = Math.floor(Math.random() * 36 ** 4)
		.toString(36)
		.padStart(4, "0");
	return `${stamp}${noise}`;
}

/**
 * The stream one test draws from: the run's seed and the test's identity, and
 * nothing about when or in what order it ran. Two tests that share a file and
 * a title share a stream, which is the same data for what is already the same
 * name.
 *
 * A test is identified by its file's path inside the suite, never the absolute
 * one, so a suite generates the same data wherever it is checked out and
 * however the runner was pointed at it.
 */
function streamFor(seed: Seed, file: string, title: string, root?: string): Random {
	let within = root === undefined ? file : relative(root, file);
	return createRandom(`${seed} ${within.split(sep).join("/")}#${title}`);
}

/** What one run and one attempt are called, as every tool call reads them. */
function identityOf(runId: string, attempt: number): RunIdentity {
	return { id: runId, attempt, nonce: `${runId}-${attempt}` };
}

/**
 * Execute every test in a loaded suite. Test failures land as outcomes in the
 * returned result, not thrown errors; only a `setup` failure or a
 * workspace-creation failure aborts the run, since a test that never got a
 * place to run has no pass or fail.
 *
 * @param options - The suite, its plugin set, the grants, and the workspace factory.
 * @returns Per-test outcomes in source order, or the error that aborted the run.
 */
export async function runTests(options: RunTestsOptions): Promise<Result<SuiteResult, SpecError>> {
	let suite = options.suite;
	let plugins = options.plugins;
	let registry = createRegistry(plugins, suite);
	let permissions = createPermissionSet(options.grants);
	let runId = options.runId ?? createRunId();
	let attempts = 1 + Math.max(0, Math.trunc(options.retries ?? 0));
	let bases = options.bases ?? createBaseSet([]);
	let connections = options.connections ?? createConnectionSet([]);

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

	/** The services every test, and every hook, executes against. */
	let services = {
		registry,
		permissions,
		grants: options.grants,
		usesFor: (definition: DefinitionNode) => usesByDefinition.get(definition) ?? [],
		fileFor: (definition: DefinitionNode) => fileByDefinition.get(definition),
		bases,
		connections,
		artifacts: options.artifacts,
	};

	/**
	 * Run one hook in a workspace of its own, under the same grants every test
	 * gets. A hook draws from the run's seed and its own file, so a `setup` that
	 * seeds generated data reproduces exactly like the tests that read it.
	 */
	async function runHook(
		hook: HookNode,
		file: SpecFileNode,
	): Promise<Result<undefined, SpecError>> {
		let workspace = await options.createWorkspace(permissions);
		if (isFailure(workspace)) return workspace;
		let context = {
			...services,
			workspace: workspace.data,
			random: streamFor(options.seed ?? DEFAULT_SEED, file.path, hook.kind, options.root),
			now: new Date(),
			uses: file.uses.map((use) => use.namespace),
			run: identityOf(runId, 1),
			file: file.path,
		};
		let outcome = await executeHook(hook, context);
		await workspace.data.cleanup();
		if (isFailure(outcome) && outcome.error.file === undefined) outcome.error.file = file.path;
		return outcome;
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
	 * Claims the next source index and runs it, repeating until the list drains
	 * or a fatal failure appears. Claiming `nextIndex` is race-free: nothing
	 * awaits between reading and incrementing it.
	 */
	async function runWorker(): Promise<void> {
		while (fatal === undefined) {
			let index = nextIndex;
			nextIndex += 1;
			if (index >= pending.length) return;
			let unit = pending[index];
			if (unit === undefined) return;
			if (unit.test.skip !== undefined) {
				results[index] = {
					title: unit.test.title,
					file: unit.filePath,
					status: "skipped",
					reason: unit.test.skip,
					durationMs: 0,
				};
				continue;
			}
			let outcome = await runAttempts(unit);
			if (outcome === undefined) return;
			results[index] = outcome;
		}
	}

	/**
	 * Run one test until it passes or runs out of attempts. Every attempt draws
	 * the same data from the same seeded stream and gets a workspace of its own,
	 * so what moves between them is the run identity's attempt number — which is
	 * what a spec composes into the identities it inserts.
	 *
	 * @returns The test's outcome, or undefined when a workspace could not be made.
	 */
	async function runAttempts(unit: {
		test: TestNode;
		filePath: string;
		imported: readonly string[];
	}): Promise<TestResult | undefined> {
		let failures: SpecError[] = [];
		let durationMs = 0;
		for (let attempt = 1; attempt <= attempts; attempt += 1) {
			let workspace = await options.createWorkspace(permissions);
			if (isFailure(workspace)) {
				fatal ??= workspace;
				return undefined;
			}
			let startedAt = performance.now();
			let context = {
				...services,
				workspace: workspace.data,
				random: streamFor(
					options.seed ?? DEFAULT_SEED,
					unit.filePath,
					unit.test.title,
					options.root,
				),
				now: new Date(),
				uses: unit.imported,
				usesFor: (definition: DefinitionNode) => usesByDefinition.get(definition) ?? unit.imported,
				run: identityOf(runId, attempt),
			};
			let outcome = await executeTest(unit.test, context);
			durationMs += performance.now() - startedAt;
			await workspace.data.cleanup();
			if (!isFailure(outcome)) {
				return {
					title: unit.test.title,
					file: unit.filePath,
					status: failures.length === 0 ? "passed" : "flaky",
					durationMs,
					...(failures.length === 0 ? {} : { attempts: failures }),
				};
			}
			let error = outcome.error;
			if (error.file === undefined) error.file = unit.filePath;
			failures.push(error);
		}
		let last = failures[failures.length - 1];
		return {
			title: unit.test.title,
			file: unit.filePath,
			status: "failed",
			durationMs,
			...(last === undefined ? {} : { error: last }),
			...(failures.length > 1 ? { attempts: failures } : {}),
		};
	}

	if (suite.setup !== undefined) {
		let outcome = await runHook(suite.setup.hook, suite.setup.file);
		if (isFailure(outcome)) {
			await disposePlugins(plugins);
			return fatalSetup(outcome.error);
		}
	}

	/**
	 * Wall-clock spans only the test-execution phase: captured immediately
	 * before workers start and immediately after the last one finishes, giving
	 * real elapsed time whether the run was sequential or concurrent.
	 */
	let wallStart = performance.now();
	let wallMs = 0;
	let teardown: TestResult | undefined;
	try {
		let workerCount = Math.min(concurrency, pending.length);
		let workers: Promise<void>[] = [];
		for (let slot = 0; slot < workerCount; slot += 1) workers.push(runWorker());
		await Promise.all(workers);
		wallMs = performance.now() - wallStart;
		/**
		 * Teardown runs after every test, failures included, since a suite that
		 * skipped it would leave the rows its tests inserted behind. It runs
		 * before the fatal check for the same reason.
		 */
		if (suite.teardown !== undefined) {
			let outcome = await runHook(suite.teardown.hook, suite.teardown.file);
			if (isFailure(outcome)) {
				teardown = {
					title: TEARDOWN_TITLE,
					file: suite.teardown.file.path,
					status: "failed",
					error: outcome.error,
					durationMs: 0,
				};
			}
		}
		if (fatal !== undefined) return fatal;
	} finally {
		/**
		 * Plugins with external state (a browser session, a connection) release
		 * it here, once per run. A throwing dispose here still lets a completed
		 * run return its results.
		 */
		await disposePlugins(plugins);
	}

	/**
	 * Every slot is filled once the run completes without a fatal failure,
	 * since each claimed index writes exactly one result; filtering here only
	 * narrows the sparse `undefined` type while preserving source order.
	 *
	 * A failed teardown joins them as a final failure: the suite may have left
	 * rows behind, which is worth an exit code even when every test held.
	 */
	let ordered = results.filter((result): result is TestResult => result !== undefined);
	if (teardown !== undefined) ordered.push(teardown);
	let counts = { passed: 0, failed: 0, skipped: 0, flaky: 0 };
	for (let result of ordered) counts[result.status] += 1;
	return success({ results: ordered, ...counts, runId, wallMs });
}

/**
 * A `setup` failure as the run reports it: the suite never reached a state its
 * tests could run in, which is a load error and exits 2, not a test failure.
 */
function fatalSetup(error: SpecError): Result<SuiteResult, SpecError> {
	let fatal = new LoadError(
		"load-error",
		`The suite's setup hook failed: ${error.message} — no test ran.`,
	);
	fatal.file = error.file;
	fatal.span = error.span;
	if (error.remedy !== undefined) fatal.remedy = error.remedy;
	if (error.hint !== undefined) fatal.hint = error.hint;
	return failure(fatal);
}

/** Release every plugin's external state, best-effort, once the run is over. */
async function disposePlugins(plugins: Plugin[]): Promise<void> {
	for (let plugin of plugins) {
		if (plugin.dispose === undefined) continue;
		try {
			await plugin.dispose();
		} catch {}
	}
}
