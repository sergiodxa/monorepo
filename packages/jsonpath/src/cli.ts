#!/usr/bin/env node
/**
 * The `sdxc-jsonpath` command-line program: the contract in `cli-contract.ts` with `query`
 * mapped onto its handler, which loads only when it runs. Exit codes: 0 done, 1 nothing
 * matched under `--fail-empty`, 2 usage, an invalid expression or unreadable JSON.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { JSONPATH_COMMANDS } from "./cli-contract.js";

/** The `sdxc-jsonpath` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-jsonpath", commands: JSONPATH_COMMANDS });

cli.map(
	JSONPATH_COMMANDS.query,
	lazy(() => import("./cli-query.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
