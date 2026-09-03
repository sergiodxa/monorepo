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

import { readFile } from "node:fs/promises";

import type { Result } from "@sdxc/result";
import type { Seed } from "@sdxc/sample";

import { failure, isFailure, success } from "@sdxc/result";
import { systemSeed } from "@sdxc/sample";

import type { Sink } from "./diagnostics.js";
import type { PermissionKind } from "./permissions.js";
import type { Plugin } from "./plugin.js";
import type { SourceFile } from "./source.js";

import { SpecError } from "./errors.js";
import { loadSuite } from "./loader.js";
import { configWouldAdmit, grantsFromConfig, mergeGrants, parseGrants } from "./permissions.js";
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
} from "./project-config.js";
import { reportFatal, reportSuite } from "./reporter.js";
import { DEFAULT_SEED } from "./run.js";
import { runSuite } from "./runner.js";

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

Generated data:
  --seed=VALUE                       Seed the data sample generates (default: fixed)
  --seed=random                      Draw a seed and print it, to replay with --seed=<it>

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
 * Config grants apply only with `--allow-config`, so a clone cannot self-grant.
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

	let configOptIn = parseConfigOptIn(argv.slice(1));
	if (isFailure(configOptIn)) {
		reportFatal(configOptIn.error, sink);
		return 2;
	}
	let { allowConfig, remaining: afterConfigOptIn } = configOptIn.data;

	let concurrencyParsed = parseConcurrency(afterConfigOptIn);
	if (isFailure(concurrencyParsed)) {
		reportFatal(concurrencyParsed.error, sink);
		return 2;
	}
	let { concurrency, remaining: afterConcurrency } = concurrencyParsed.data;

	let seedParsed = parseSeed(afterConcurrency);
	if (isFailure(seedParsed)) {
		reportFatal(seedParsed.error, sink);
		return 2;
	}
	let { seed, drawn, remaining: afterSeed } = seedParsed.data;

	let pluginParsed = parsePluginGrant(afterSeed);
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

	let config = await loadProjectConfig(root);
	if (isFailure(config)) {
		reportFatal(config.error, sink);
		return 2;
	}

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

	if (drawn) sink.write(`seed ${seed} (replay with --seed=${seed})\n\n`);

	let run = await runSuite({ root, grants, plugins: externalPlugins, concurrency, seed });
	if (isFailure(run)) {
		await disposeAll(externalPlugins);
		reportFatal(run.error, sink);
		return 2;
	}

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
	return run.data.failed > 0 ? 1 : 0;
}

/**
 * Peel the bare `--allow-config` flag out of an argument list, opting into
 * the permissions `spec/config.jsonc` declares; `--allow-config=…` is a usage
 * error since the flag takes no value. Other arguments pass through untouched.
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
 * Peel `--concurrency=N` (or its `--jobs=N` alias) out of an argument list; N
 * sets how many tests run at once and defaults to 1. A missing, malformed, or
 * non-positive value is a usage error; a repeated flag keeps the last value.
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
 * Peel `--seed=VALUE` out of an argument list. `--seed=random` draws one, which
 * the caller prints so a run that turned up a bad value can be replayed;
 * anything else is taken as written, since text and numbers both name a stream.
 * Omitting the flag keeps the runner's fixed default, so a bare run repeats.
 *
 * @param argv - Arguments after the earlier flags were peeled off.
 * @returns The seed, whether it was drawn, and the remaining arguments.
 */
function parseSeed(
	argv: string[],
): Result<{ seed: Seed; drawn: boolean; remaining: string[] }, SpecError> {
	let remaining: string[] = [];
	let seed: Seed = DEFAULT_SEED;
	let drawn = false;
	for (let argument of argv) {
		if (argument !== "--seed" && !argument.startsWith("--seed=")) {
			remaining.push(argument);
			continue;
		}
		let value = argument === "--seed" ? "" : argument.slice("--seed=".length);
		if (value === "") {
			return failure(
				new SpecError(
					"usage-error",
					"--seed expects a value, e.g. --seed=checkout or --seed=random to draw one.",
				),
			);
		}
		if (value === "random") {
			seed = systemSeed();
			drawn = true;
			continue;
		}
		seed = /^\d+$/.test(value) ? Number(value) : value;
		drawn = false;
	}
	return success({ seed, drawn, remaining });
}

/**
 * Match a concurrency flag and split off its value, recognizing both
 * `--concurrency` and `--jobs` in `--flag=value` form. The bare `--flag` form
 * matches with an empty value so the caller reports the missing-value usage error.
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
	let code = await main(process.argv.slice(2), sink);
	process.exit(code);
}
