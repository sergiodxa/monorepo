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
import type { SourceFile } from "./source";

import { SpecError } from "./errors";
import { parseGrants } from "./permissions";
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

	let parsed = parseGrants(argv.slice(1));
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

	let run = await runSuite({ root, grants });
	if (isFailure(run)) {
		reportFatal(run.error, sink);
		return 2;
	}

	let sources = new Map<string, SourceFile>();
	for (let result of run.data.results) {
		if (!sources.has(result.file)) {
			let text = await Bun.file(result.file)
				.text()
				.catch(() => "");
			sources.set(result.file, { path: result.file, text });
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
