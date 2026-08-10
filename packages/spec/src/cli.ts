#!/usr/bin/env bun
/**
 * The `spec` command-line interface. `spec run [dir] [--allow-*]` loads a
 * suite and executes it under the caller's grants — nothing is granted by
 * default, and a permission failure is a security feature, not a bug.
 * Exit codes: 0 all passed, 1 some test failed, 2 usage or load error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { Sink } from "./diagnostics";
import type { PermissionKind } from "./permissions";
import type { Plugin } from "./plugin";
import type { SourceFile } from "./source";

import { SpecError } from "./errors";
import { loadSuite } from "./loader";
import { configWouldAdmit, grantsFromConfig, mergeGrants, parseGrants } from "./permissions";
import {
	connectDeclaredPlugins,
	deniedReferences,
	disposeAll,
	launchDeniedError,
	loadProjectConfig,
	mergePluginGrants,
	parsePluginGrant,
	planPluginLaunch,
	pluginGrantAdmits,
	pluginGrantFromConfig,
} from "./project-config";
import { reportFatal, reportSuite } from "./reporter";
import { runSuite } from "./runner";

/**
 * The line appended to a permission denial when the project's
 * `spec/config.jsonc` would have granted it under `--allow-config`. Points at
 * the one-flag path without ever weakening the primary `--allow-*` remedy.
 */
const CONFIG_HINT =
	"This project's spec/config.jsonc declares this permission; re-run with --allow-config to apply the project's declared permissions.";

/** What `spec --help` prints. */
const USAGE = `spec — executable specifications

Usage:
  spec run [directory] [--allow-*]     Run the suite (directory defaults to ./spec)

Scheduling:
  --concurrency=N (alias --jobs=N)   Run up to N tests at once (default 1, sequential)

Permissions (denied unless granted):
  --allow-run[=name,...]      Execute processes (scoped to executable names)
  --allow-net[=host[:port]]   Reach the network (scoped to hosts)
  --allow-env[=VAR,...]       Read environment variables (scoped to names)
  --allow-host-fs[=dir,...]   Touch the host filesystem outside the workspace
  --allow-plugins[=ns,...]    Launch project-declared plugins (from spec/config.jsonc)
  --allow-config              Apply the permissions spec/config.jsonc declares
`;

/**
 * Run the CLI against an argument vector and write through the sink —
 * separated from the entry point so tests can drive it without a process.
 *
 * @param argv - Arguments after the program name, e.g. `["run", "spec"]`.
 * @param sink - Where human output goes.
 * @returns The process exit code to use.
 */
export async function main(argv: string[], sink: Sink): Promise<number> {
	if (argv[0] === "--help" || argv[0] === "-h" || argv.length === 0) {
		sink.write(USAGE);
		return argv.length === 0 ? 2 : 0;
	}
	if (argv[0] !== "run") {
		reportFatal(new SpecError("usage-error", `Unknown command: ${argv[0]}`), sink);
		sink.write(USAGE);
		return 2;
	}

	// `--allow-config` opts into the permissions the project's spec/config.jsonc
	// declares. It is a bare flag, not a capability family, so it is peeled off
	// first — before the plugin and permission parsers, which would not know it.
	let configOptIn = parseConfigOptIn(argv.slice(1));
	if (isFailure(configOptIn)) {
		reportFatal(configOptIn.error, sink);
		return 2;
	}
	let { allowConfig, remaining: afterConfigOptIn } = configOptIn.data;

	// `--concurrency=N` (alias `--jobs=N`) is a scheduling flag, not a permission
	// family, so it is peeled off before the plugin and permission parsers, which
	// would otherwise flag it as an unknown flag. Absent, it defaults to 1.
	let concurrencyParsed = parseConcurrency(afterConfigOptIn);
	if (isFailure(concurrencyParsed)) {
		reportFatal(concurrencyParsed.error, sink);
		return 2;
	}
	let { concurrency, remaining: afterConcurrency } = concurrencyParsed.data;

	// `--allow-plugins` authorizes launching declared plugins; it is not one of
	// the four capability families, so it is peeled off before the permission
	// parser (which would reject it as an unknown `--allow-*` flag) sees it.
	let pluginParsed = parsePluginGrant(afterConcurrency);
	if (isFailure(pluginParsed)) {
		reportFatal(pluginParsed.error, sink);
		return 2;
	}
	let { grant: cliPluginGrant, remaining: afterPluginGrant } = pluginParsed.data;

	let parsed = parseGrants(afterPluginGrant);
	if (isFailure(parsed)) {
		reportFatal(parsed.error, sink);
		return 2;
	}
	let { grants: cliGrants, remaining } = parsed.data;
	let unknown = remaining.filter((argument) => argument.startsWith("-"));
	if (unknown.length > 0) {
		reportFatal(new SpecError("usage-error", `Unknown flag: ${unknown[0]}`), sink);
		return 2;
	}
	if (remaining.length > 1) {
		reportFatal(
			new SpecError("usage-error", `Expected one suite directory, got: ${remaining.join(", ")}`),
			sink,
		);
		return 2;
	}
	let root = remaining[0] ?? "spec";

	// Load the per-project spec/config.jsonc and decide which declared plugins
	// the caller authorized to launch. Deny-by-default: a suite that imports a
	// declared-but-unauthorized plugin is refused before any process starts.
	let config = await loadProjectConfig(root);
	if (isFailure(config)) {
		reportFatal(config.error, sink);
		return 2;
	}

	// Deny-by-default with declare + opt-in: the config's declared grants apply
	// only when `--allow-config` is passed, and then they *union* with the CLI's
	// own flags (flags always add to, never subtract from, the config set).
	// Without the flag the declaration is inert, so a cloned repo cannot
	// self-grant. The declared plugin launch grant is folded in the same way.
	let configEntries = config.data.permissions.allow;
	let configGrants = grantsFromConfig(configEntries);
	let grants = allowConfig ? mergeGrants(cliGrants, configGrants) : cliGrants;
	let configPluginGrant = pluginGrantFromConfig(configEntries);
	let pluginGrant = allowConfig
		? mergePluginGrants(cliPluginGrant, configPluginGrant)
		: cliPluginGrant;

	let { launch, deniedNamespaces } = planPluginLaunch(config.data, pluginGrant);
	if (deniedNamespaces.length > 0) {
		let loaded = await loadSuite(root);
		if (isFailure(loaded)) {
			reportFatal(loaded.error, sink);
			return 2;
		}
		let referenced = deniedReferences(loaded.data, deniedNamespaces);
		if (referenced.length > 0) {
			let error = launchDeniedError(referenced);
			// If the caller has not opted in but the config *would* authorize
			// launching every refused plugin, point at the one-flag path too.
			if (!allowConfig && referenced.every((ns) => pluginGrantAdmits(configPluginGrant, ns))) {
				error.hint = CONFIG_HINT;
			}
			reportFatal(error, sink);
			return 2;
		}
	}

	let externalPlugins: Plugin[] = [];
	if (launch.length > 0) {
		let connected = await connectDeclaredPlugins(launch);
		if (isFailure(connected)) {
			reportFatal(connected.error, sink);
			return 2;
		}
		externalPlugins = connected.data;
	}

	let run = await runSuite({ root, grants, plugins: externalPlugins, concurrency });
	if (isFailure(run)) {
		// The runner disposes plugins only once it starts executing; a load
		// failure returns before that, so release the launched plugins here.
		await disposeAll(externalPlugins);
		reportFatal(run.error, sink);
		return 2;
	}

	// When the caller has not opted in, annotate any denial the config *would*
	// have granted with the one-flag hint — computed here because the CLI is the
	// only layer that holds both the run's denials and the loaded config.
	if (!allowConfig) {
		for (let result of run.data.results) {
			let error = result.error;
			if (error === undefined || error.code !== "permission-denied") continue;
			let denial = error as SpecError & {
				permission?: PermissionKind;
				resource?: string;
				familyGate?: boolean;
			};
			if (denial.permission === undefined || denial.resource === undefined) continue;
			// A coarse family-gate denial hides the real resource behind a tool
			// name, so the hint keys off the family being declared; a scope-level
			// denial carries a real resource the config's scope must itself cover.
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
		// A failure inside a cross-file command or fixture is anchored to the
		// defining file, so that file's text is needed alongside the test's own.
		let paths = [result.file];
		if (result.error?.file !== undefined) paths.push(result.error.file);
		for (let path of paths) {
			if (!sources.has(path)) {
				let text = await Bun.file(path)
					.text()
					.catch(() => "");
				sources.set(path, { path, text });
			}
		}
	}
	reportSuite(run.data, sources, sink);
	return run.data.failed > 0 ? 1 : 0;
}

/**
 * Peel the bare `--allow-config` flag out of an argument list. It opts into the
 * permissions the project's `spec/config.jsonc` declares; it takes no value, so
 * a `--allow-config=…` form is a usage error. Every other argument passes
 * through untouched for the plugin and permission parsers.
 *
 * @param args - The raw CLI arguments after `run`.
 * @returns Whether the opt-in was given, plus the remaining arguments.
 */
function parseConfigOptIn(
	args: string[],
): Result<{ allowConfig: boolean; remaining: string[] }, SpecError> {
	let allowConfig = false;
	let remaining: string[] = [];
	for (let argument of args) {
		if (argument === "--allow-config") {
			allowConfig = true;
			continue;
		}
		if (argument.startsWith("--allow-config=")) {
			return failure(
				new SpecError(
					"usage-error",
					"--allow-config takes no value; it is a bare flag that applies the permissions spec/config.jsonc declares.",
				),
			);
		}
		remaining.push(argument);
	}
	return success({ allowConfig, remaining });
}

/**
 * Peel `--concurrency=N` (and its `--jobs=N` alias) out of an argument list. N
 * is how many tests the runner may execute at once; it must be a positive
 * integer. Absent, concurrency defaults to 1 (sequential). A malformed or
 * non-positive value — including the bare flag with no `=value` — is a usage
 * error; a repeated flag takes the last value. Every other argument passes
 * through untouched for the plugin and permission parsers.
 *
 * @param args - The raw CLI arguments after the config opt-in was removed.
 * @returns The chosen concurrency and the remaining arguments.
 */
function parseConcurrency(
	args: string[],
): Result<{ concurrency: number; remaining: string[] }, SpecError> {
	let concurrency = 1;
	let remaining: string[] = [];
	for (let argument of args) {
		let flag = matchConcurrencyFlag(argument);
		if (flag === undefined) {
			remaining.push(argument);
			continue;
		}
		let value = parsePositiveInteger(flag.value);
		if (value === undefined) {
			return failure(
				new SpecError(
					"usage-error",
					`${flag.name} expects a positive integer, e.g. ${flag.name}=8; got ${JSON.stringify(flag.value)}.`,
				),
			);
		}
		concurrency = value;
	}
	return success({ concurrency, remaining });
}

/**
 * Match a concurrency flag and split off its value. Recognizes both spellings,
 * `--concurrency` and its `--jobs` alias, in the `--flag=value` form; the bare
 * `--flag` form matches with an empty value so the caller reports it as the
 * usage error it is (the flag needs a value).
 *
 * @param argument - One raw CLI argument.
 * @returns The matched flag name and its value, or undefined for a non-match.
 */
function matchConcurrencyFlag(argument: string): { name: string; value: string } | undefined {
	for (let name of ["--concurrency", "--jobs"]) {
		if (argument === name) return { name, value: "" };
		if (argument.startsWith(`${name}=`)) return { name, value: argument.slice(name.length + 1) };
	}
	return undefined;
}

/**
 * Parse a strictly positive integer written in decimal, rejecting everything
 * else — empty strings, signs, decimals, whitespace, and non-numeric text — so
 * the caller can turn a bad `--concurrency` value into a usage error.
 *
 * @param text - The flag's raw value.
 * @returns The integer, or undefined when the text is not a positive integer.
 */
function parsePositiveInteger(text: string): number | undefined {
	if (!/^\d+$/.test(text)) return undefined;
	let value = Number(text);
	if (!Number.isInteger(value) || value < 1) return undefined;
	return value;
}

if (import.meta.main) {
	let sink: Sink = { write: (text) => void process.stdout.write(text) };
	let code = await main(Bun.argv.slice(2), sink);
	process.exit(code);
}
