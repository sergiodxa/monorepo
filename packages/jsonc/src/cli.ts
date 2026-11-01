#!/usr/bin/env node
/**
 * The `sdxc-jsonc` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, loaded only when that command runs. Exit codes: 0 done, 1 parse
 * errors found by `check`, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { JSONC_COMMANDS } from "./cli-contract.js";

/** The `sdxc-jsonc` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-jsonc", commands: JSONC_COMMANDS });

cli.map(
	JSONC_COMMANDS.check,
	lazy(() => import("./cli-check.js")),
);
cli.map(
	JSONC_COMMANDS.strip,
	lazy(() => import("./cli-strip.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
