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

import { isFailure } from "@pkg/result";

import type { Sink } from "./diagnostics";
import type { Plugin } from "./plugin";
import type { SourceFile } from "./source";

import { SpecError } from "./errors";
import { loadSuite } from "./loader";
import { parseGrants } from "./permissions";
import {
	connectManifestPlugins,
	deniedReferences,
	disposeAll,
	launchDeniedError,
	loadPluginManifest,
	parsePluginGrant,
	planPluginLaunch,
} from "./project-plugins";
import { reportFatal, reportSuite } from "./reporter";
import { runSuite } from "./runner";

/** What `spec --help` prints. */
const USAGE = `spec — executable specifications

Usage:
  spec run [directory] [--allow-*]     Run the suite (directory defaults to ./spec)

Permissions (denied unless granted):
  --allow-run[=name,...]      Execute processes (scoped to executable names)
  --allow-net[=host[:port]]   Reach the network (scoped to hosts)
  --allow-env[=VAR,...]       Read environment variables (scoped to names)
  --allow-host-fs[=dir,...]   Touch the host filesystem outside the workspace
  --allow-plugins[=ns,...]    Launch project-declared plugins (from the manifest)
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

	// `--allow-plugins` authorizes launching manifest plugins; it is not one of
	// the four capability families, so it is peeled off before the permission
	// parser (which would reject it as an unknown `--allow-*` flag) sees it.
	let pluginParsed = parsePluginGrant(argv.slice(1));
	if (isFailure(pluginParsed)) {
		reportFatal(pluginParsed.error, sink);
		return 2;
	}
	let { grant: pluginGrant, remaining: afterPluginGrant } = pluginParsed.data;

	let parsed = parseGrants(afterPluginGrant);
	if (isFailure(parsed)) {
		reportFatal(parsed.error, sink);
		return 2;
	}
	let { grants, remaining } = parsed.data;
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

	// Load the per-project plugin manifest and decide which declared plugins the
	// caller authorized to launch. Deny-by-default: a suite that imports a
	// declared-but-unauthorized plugin is refused before any process starts.
	let manifest = await loadPluginManifest(root);
	if (isFailure(manifest)) {
		reportFatal(manifest.error, sink);
		return 2;
	}
	let { launch, deniedNamespaces } = planPluginLaunch(manifest.data, pluginGrant);
	if (deniedNamespaces.length > 0) {
		let loaded = await loadSuite(root);
		if (isFailure(loaded)) {
			reportFatal(loaded.error, sink);
			return 2;
		}
		let referenced = deniedReferences(loaded.data, deniedNamespaces);
		if (referenced.length > 0) {
			reportFatal(launchDeniedError(referenced), sink);
			return 2;
		}
	}

	let externalPlugins: Plugin[] = [];
	if (launch.length > 0) {
		let connected = await connectManifestPlugins(launch);
		if (isFailure(connected)) {
			reportFatal(connected.error, sink);
			return 2;
		}
		externalPlugins = connected.data;
	}

	let run = await runSuite({ root, grants, plugins: externalPlugins });
	if (isFailure(run)) {
		// The runner disposes plugins only once it starts executing; a load
		// failure returns before that, so release the launched plugins here.
		await disposeAll(externalPlugins);
		reportFatal(run.error, sink);
		return 2;
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

if (import.meta.main) {
	let sink: Sink = { write: (text) => void process.stdout.write(text) };
	let code = await main(Bun.argv.slice(2), sink);
	process.exit(code);
}
