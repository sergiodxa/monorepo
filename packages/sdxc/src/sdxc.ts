#!/usr/bin/env node
/**
 * The `sdxc` binary: runs the command line against the process's own working directory and
 * streams, and leaves the exit code for Node or Bun to report once output has flushed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { createSDXC } from "./sdxc/cli.js";
import { run } from "./sdxc/run.js";

/** The version in this package's `package.json`, which sits beside both `src/` and `dist/`. */
function ownVersion(): string | undefined {
	let manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
		version?: unknown;
	};
	return typeof manifest.version === "string" ? manifest.version : undefined;
}

let argv = process.argv.slice(2);
let handled = await run(argv, {
	cwd: process.cwd(),
	stdout: (text) => process.stdout.write(text),
	stderr: (text) => process.stderr.write(text),
});
process.exitCode = handled ?? (await createSDXC({ version: ownVersion() }).run(argv));
