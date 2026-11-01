#!/usr/bin/env node
/**
 * The `sdxc-typeid` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, which loads only when that command runs. Exit codes: 0 done, 1 the
 * TypeID `parse` read is invalid, 2 usage or unusable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { TYPEID_COMMANDS } from "./cli-contract.js";

/** The `sdxc-typeid` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-typeid", commands: TYPEID_COMMANDS });

cli.map(
	TYPEID_COMMANDS.new,
	lazy(() => import("./cli-new.js")),
);
cli.map(
	TYPEID_COMMANDS.parse,
	lazy(() => import("./cli-parse.js")),
);
cli.map(
	TYPEID_COMMANDS.encode,
	lazy(() => import("./cli-encode.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
