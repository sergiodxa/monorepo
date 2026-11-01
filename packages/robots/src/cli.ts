#!/usr/bin/env node
/**
 * The `sdxc-robots` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, which loads only when that command runs. Exit codes: 0 done, 1 the
 * URL is disallowed, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { ROBOTS_COMMANDS } from "./cli-contract.js";

/** The `sdxc-robots` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-robots", commands: ROBOTS_COMMANDS });

cli.map(
	ROBOTS_COMMANDS.check,
	lazy(() => import("./cli-check.js")),
);
cli.map(
	ROBOTS_COMMANDS.parse,
	lazy(() => import("./cli-parse.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
