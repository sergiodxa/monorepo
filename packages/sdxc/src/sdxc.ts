#!/usr/bin/env node
/**
 * The `sdxc` binary: runs the command line against the process's own working directory and
 * streams, and leaves the exit code for Node or Bun to report once output has flushed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "./sdxc/run.js";

process.exitCode = await run(process.argv.slice(2), {
	cwd: process.cwd(),
	stdout: (text) => process.stdout.write(text),
	stderr: (text) => process.stderr.write(text),
});
