/**
 * The `spec run` handler: loads a suite and executes it under the caller's grants. Nothing is
 * granted by default, and the permissions `spec/config.jsonc` declares apply only with
 * `--allow-config`, so a cloned repository cannot grant itself anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";

import type { Seed } from "@sdxc/random";

import { createCommand, exit, success } from "@sdxc/cli";
import { systemSeed } from "@sdxc/random";
import { isFailure } from "@sdxc/result";

import type { Sink } from "./diagnostics.js";
import type { SpecError } from "./errors.js";
import type { Grant, PermissionKind } from "./permissions.js";
import type { Plugin } from "./plugin.js";
import type { PluginLaunchGrant } from "./project-config.js";
import type { SourceFile } from "./source.js";

import { createArtifactStore } from "./artifacts.js";
import { createBaseSet, createConnectionSet } from "./bases.js";
import { SPEC_COMMANDS } from "./cli-contract.js";
import { loadSuite } from "./loader.js";
import { configWouldAdmit, grantsFromConfig, mergeGrants } from "./permissions.js";
import {
	connectDeclaredPlugins,
	deniedReferences,
	disposeAll,
	launchDeniedError,
	loadProjectConfig,
	mergePluginGrants,
	planPluginLaunch,
	pluginGrantAdmits,
	pluginGrantFromConfig,
} from "./project-config.js";
import { reportFatal, reportRunHeader, reportSuite } from "./reporter.js";
import { createRunId, DEFAULT_SEED } from "./run.js";
import { runSuite } from "./runner.js";

/**
 * The line appended to a permission denial when the project's `spec/config.jsonc` would have
 * granted it under `--allow-config`. Points at the one-flag path without ever weakening the
 * primary `--allow-*` remedy.
 */
const CONFIG_HINT =
	"This project's spec/config.jsonc declares this permission; re-run with --allow-config to apply the project's declared permissions.";

/**
 * A permission flag's value as a grant: missing denies, bare grants the family, and a scope
 * list grants each scope once.
 *
 * @param value - What `--allow-<family>` read: `true` when bare, else its scopes
 */
function grantOf(value: true | string[]): Grant {
	if (value === true) return { mode: "all" };
	if (value.length === 0) return { mode: "denied" };
	return { mode: "scoped", scopes: [...new Set(value)] };
}

/**
 * The `--allow-plugins` value as a launch grant, read the way {@link grantOf} reads a
 * capability family.
 *
 * @param value - What `--allow-plugins` read: `true` when bare, else its namespaces
 */
function pluginGrantOf(value: true | string[]): PluginLaunchGrant {
	if (value === true) return { mode: "all" };
	if (value.length === 0) return { mode: "denied" };
	return { mode: "scoped", namespaces: [...new Set(value)] };
}

/**
 * The run's seed: `random` draws one, which the run header prints so a run that turned up a bad
 * value can be replayed; digits are a number and other text names a stream as written. A
 * missing seed keeps the fixed default, so a bare run repeats.
 *
 * @param value - What `--seed` read, when given
 */
function seedOf(value: string | undefined): Seed {
	if (value === undefined) return DEFAULT_SEED;
	if (value === "random") return systemSeed();
	return /^\d+$/.test(value) ? Number(value) : value;
}

/**
 * Runs the suite and reports it on stdout. Exits 0 when every test passed, 1 when one failed,
 * and 2 when the suite, its config or a declared plugin could not be loaded; the reporter has
 * already printed why, so the exit carries no message of its own.
 */
export default createCommand(SPEC_COMMANDS.run, async (ctx) => {
	let sink: Sink = { write: (text) => ctx.stdout(text) };
	let fatal = (error: SpecError) => {
		reportFatal(error, sink);
		return exit(2);
	};
	let { flags } = ctx;
	let root = ctx.arguments.directory;
	let seed = seedOf(flags.seed);
	let runId = flags.runId ?? createRunId();
	let artifacts = flags.artifacts === undefined ? undefined : createArtifactStore(flags.artifacts);
	let cliGrants = {
		run: grantOf(flags.allowRun),
		net: grantOf(flags.allowNet),
		env: grantOf(flags.allowEnv),
		hostFs: grantOf(flags.allowHostFs),
		db: grantOf(flags.allowDb),
	};
	let cliPluginGrant = pluginGrantOf(flags.allowPlugins);

	let config = await loadProjectConfig(root);
	if (isFailure(config)) return fatal(config.error);

	let configEntries = config.data.permissions.allow;
	let configGrants = grantsFromConfig(configEntries);
	let grants = flags.allowConfig ? mergeGrants(cliGrants, configGrants) : cliGrants;
	let configPluginGrant = pluginGrantFromConfig(configEntries);
	let pluginGrant = flags.allowConfig
		? mergePluginGrants(cliPluginGrant, configPluginGrant)
		: cliPluginGrant;

	let { launch, deniedNamespaces } = planPluginLaunch(config.data, pluginGrant);
	if (deniedNamespaces.length > 0) {
		let loaded = await loadSuite(root);
		if (isFailure(loaded)) return fatal(loaded.error);
		let referenced = deniedReferences(loaded.data, deniedNamespaces);
		if (referenced.length > 0) {
			let error = launchDeniedError(referenced);
			if (
				!flags.allowConfig &&
				referenced.every((ns) => pluginGrantAdmits(configPluginGrant, ns))
			) {
				error.hint = CONFIG_HINT;
			}
			return fatal(error);
		}
	}

	let externalPlugins: Plugin[] = [];
	if (launch.length > 0) {
		let connected = await connectDeclaredPlugins(launch);
		if (isFailure(connected)) return fatal(connected.error);
		externalPlugins = connected.data;
	}

	let bases = createBaseSet(config.data.bases);
	let connections = createConnectionSet(config.data.databases);
	reportRunHeader({ seed, runId, bases: bases.list() }, sink);

	let run = await runSuite({
		root,
		grants,
		plugins: externalPlugins,
		concurrency: flags.concurrency,
		seed,
		runId,
		retries: flags.retries,
		bases,
		connections,
		artifacts,
	});
	if (isFailure(run)) {
		await disposeAll(externalPlugins);
		return fatal(run.error);
	}

	if (!flags.allowConfig) {
		for (let result of run.data.results) {
			let error = result.error;
			if (error === undefined || error.code !== "permission-denied") continue;
			let denial = error as SpecError & {
				permission?: PermissionKind;
				resource?: string;
				familyGate?: boolean;
			};
			if (denial.permission === undefined || denial.resource === undefined) continue;
			if (
				configWouldAdmit(
					configGrants,
					denial.permission,
					denial.resource,
					denial.familyGate ?? false,
				)
			)
				error.hint = CONFIG_HINT;
		}
	}

	let sources = new Map<string, SourceFile>();
	for (let result of run.data.results) {
		let paths = [result.file];
		if (result.error?.file !== undefined) paths.push(result.error.file);
		for (let path of paths) {
			if (!sources.has(path)) {
				let text = await readFile(path, "utf8").catch(() => "");
				sources.set(path, { path, text });
			}
		}
	}
	reportSuite(run.data, sources, sink);
	return run.data.failed > 0 ? exit(1) : success();
});
