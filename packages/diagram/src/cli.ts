#!/usr/bin/env node
/**
 * The `sdxc-diagram` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, which loads only when that command runs. Exit codes: 0 done, 1 the
 * check found unsupported syntax, 2 usage, unreadable input or a diagram `render` cannot draw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { DIAGRAM_COMMANDS } from "./cli-contract.js";

/** The `sdxc-diagram` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-diagram", commands: DIAGRAM_COMMANDS });

cli.map(
	DIAGRAM_COMMANDS.render,
	lazy(() => import("./cli-render.js")),
);
cli.map(
	DIAGRAM_COMMANDS.check,
	lazy(() => import("./cli-check.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
