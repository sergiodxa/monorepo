#!/usr/bin/env node
/**
 * The `sdxc-merge-patch` command-line program: the contract in `cli-contract.ts` with each
 * command mapped onto its handler, which loads only when that command runs. Exit codes: 0
 * done, 1 a change no merge patch can express, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { MERGE_PATCH_COMMANDS } from "./cli-contract.js";

/** The `sdxc-merge-patch` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-merge-patch", commands: MERGE_PATCH_COMMANDS });

cli.map(
	MERGE_PATCH_COMMANDS.apply,
	lazy(() => import("./cli-apply.js")),
);
cli.map(
	MERGE_PATCH_COMMANDS.diff,
	lazy(() => import("./cli-diff.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
