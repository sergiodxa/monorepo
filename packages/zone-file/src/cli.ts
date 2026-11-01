#!/usr/bin/env node
/**
 * The `sdxc-zone-file` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, which loads only when that command runs. Exit codes: 0 done, 1 the
 * zone file has entries it could not use, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { ZONE_FILE_COMMANDS } from "./cli-contract.js";

/** The `sdxc-zone-file` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-zone-file", commands: ZONE_FILE_COMMANDS });

cli.map(
	ZONE_FILE_COMMANDS.validate,
	lazy(() => import("./cli-validate.js")),
);
cli.map(
	ZONE_FILE_COMMANDS.parse,
	lazy(() => import("./cli-parse.js")),
);
cli.map(
	ZONE_FILE_COMMANDS.format,
	lazy(() => import("./cli-format.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
