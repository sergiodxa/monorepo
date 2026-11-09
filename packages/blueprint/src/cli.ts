#!/usr/bin/env node
/**
 * The `sdxc-blueprint` command-line program: the contract in `cli-contract.ts` mapped onto its
 * handler, which loads only when the program runs. Exit codes: 0 done, 1 files exist and nothing
 * was written, 2 usage, a missing value or a stub that does not parse or render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { BLUEPRINT_COMMANDS } from "./cli-contract.js";

/** The `sdxc-blueprint` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-blueprint", commands: BLUEPRINT_COMMANDS });

cli.map(
	BLUEPRINT_COMMANDS,
	lazy(() => import("./cli-run.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
