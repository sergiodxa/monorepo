#!/usr/bin/env node
/**
 * The `sdxc-font` command-line program: the contract in `cli-contract.ts` with `inspect` and
 * `subset` mapped onto their handlers, each loaded only when its command runs. Exit codes: 0
 * done, 1 the font's license forbids the subset, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { FONT_COMMANDS } from "./cli-contract.js";

/** The `sdxc-font` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-font", commands: FONT_COMMANDS });

cli.map(
	FONT_COMMANDS.inspect,
	lazy(() => import("./cli-inspect.js")),
);
cli.map(
	FONT_COMMANDS.subset,
	lazy(() => import("./cli-subset.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
