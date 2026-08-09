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

import type { DefinitionNode } from "./ast";
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

	let results: TestResult[] = [];
	try {
		for (let file of suite.files) {
			let imported = file.uses.map((use) => use.namespace);
			for (let test of file.tests) {
				let workspace = await createWorkspace(permissions);
				if (isFailure(workspace)) return workspace;
				let startedAt = performance.now();
				let outcome = await executeTest(test, {
					registry,
					workspace: workspace.data,
					permissions,
					uses: imported,
					usesFor: (definition) => usesByDefinition.get(definition) ?? imported,
					fileFor: (definition) => fileByDefinition.get(definition),
					grants: options.grants,
				});
				let durationMs = performance.now() - startedAt;
				await workspace.data.cleanup();
				if (isFailure(outcome)) {
					let error = outcome.error;
					if (error.file === undefined) error.file = file.path;
					results.push({ title: test.title, file: file.path, status: "failed", error, durationMs });
				} else {
					results.push({ title: test.title, file: file.path, status: "passed", durationMs });
				}
			}
		}
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

	let passed = results.filter((result) => result.status === "passed").length;
	return success({ results, passed, failed: results.length - passed });
}
